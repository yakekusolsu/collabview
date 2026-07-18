import CoreGraphics
import CoreImage
import CoreMedia
import Foundation
import ImageIO
import ScreenCaptureKit
import UniformTypeIdentifiers

struct CaptureSourcePayload: Codable {
    let id: String
    let name: String
    let kind: String
    let width: Int
    let height: Int
    let appName: String?
    let bundleIdentifier: String?
    let processId: Int?
}

struct FramePayload: Codable {
    let path: String
    let width: Int
    let height: Int
    let timestampNs: UInt64
}

enum HelperError: Error, CustomStringConvertible {
    case unsupportedOS
    case invalidArguments(String)
    case sourceNotFound(String)
    case streamStartFailed
    case frameTimeout
    case imageConversionFailed
    case imageWriteFailed(String)

    var description: String {
        switch self {
        case .unsupportedOS:
            return "ScreenCaptureKit requires macOS 12.3 or later."
        case .invalidArguments(let message):
            return message
        case .sourceNotFound(let id):
            return "Capture source was not found: \(id)"
        case .streamStartFailed:
            return "ScreenCaptureKit stream could not be started."
        case .frameTimeout:
            return "Timed out waiting for the first captured frame."
        case .imageConversionFailed:
            return "Could not convert captured frame to an image."
        case .imageWriteFailed(let path):
            return "Could not write captured frame to \(path)."
        }
    }
}

@main
struct CollabViewCaptureHelper {
    static func main() async {
        do {
            guard #available(macOS 12.3, *) else {
                throw HelperError.unsupportedOS
            }
            let arguments = Array(CommandLine.arguments.dropFirst())
            guard let command = arguments.first else {
                throw HelperError.invalidArguments("Expected a command: list or frame.")
            }
            switch command {
            case "list":
                let payload = try await ScreenCaptureService.listSources()
                try printJson(payload)
            case "frame":
                let options = try FrameOptions(arguments: Array(arguments.dropFirst()))
                let payload = try await ScreenCaptureService.captureFrame(options: options)
                try printJson(payload)
            default:
                throw HelperError.invalidArguments("Unknown command: \(command)")
            }
        } catch {
            FileHandle.standardError.write(Data("\(error)\n".utf8))
            Foundation.exit(1)
        }
    }

    private static func printJson<T: Encodable>(_ value: T) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(value)
        FileHandle.standardOutput.write(data)
        FileHandle.standardOutput.write(Data("\n".utf8))
    }
}

struct FrameOptions {
    let kind: String
    let id: String
    let outputPath: String
    let width: Int
    let height: Int
    let fps: Int
    let showsCursor: Bool
    let timeoutMs: UInt64

    init(arguments: [String]) throws {
        var values: [String: String] = [:]
        var index = 0
        while index < arguments.count {
            let key = arguments[index]
            guard key.hasPrefix("--"), index + 1 < arguments.count else {
                throw HelperError.invalidArguments("Invalid frame argument: \(key)")
            }
            values[String(key.dropFirst(2))] = arguments[index + 1]
            index += 2
        }

        kind = values["kind"] ?? "display"
        id = values["id"] ?? ""
        outputPath = values["output"] ?? ""
        width = Int(values["width"] ?? "1280") ?? 1280
        height = Int(values["height"] ?? "720") ?? 720
        fps = Int(values["fps"] ?? "30") ?? 30
        showsCursor = values["showsCursor"] != "false"
        timeoutMs = UInt64(values["timeoutMs"] ?? "3000") ?? 3000

        guard ["display", "window"].contains(kind) else {
            throw HelperError.invalidArguments("Frame kind must be display or window.")
        }
        guard !id.isEmpty else {
            throw HelperError.invalidArguments("Frame source id is required.")
        }
        guard !outputPath.isEmpty else {
            throw HelperError.invalidArguments("Frame output path is required.")
        }
    }
}

@available(macOS 12.3, *)
enum ScreenCaptureService {
    static func listSources() async throws -> [CaptureSourcePayload] {
        let content = try await SCShareableContent.excludingDesktopWindows(
            false,
            onScreenWindowsOnly: true
        )

        let displays = content.displays.map { display in
            CaptureSourcePayload(
                id: "display:\(display.displayID)",
                name: "Display \(display.displayID)",
                kind: "display",
                width: display.width,
                height: display.height,
                appName: nil,
                bundleIdentifier: nil,
                processId: nil
            )
        }

        let applicationsByPid = Dictionary(
            uniqueKeysWithValues: content.applications.map { application in
                (application.processID, application)
            }
        )

        let windows = content.windows.compactMap { window -> CaptureSourcePayload? in
            guard window.windowID != 0 else { return nil }
            let application = applicationsByPid[window.owningApplication?.processID ?? 0]
            let title = window.title?.isEmpty == false ? window.title! : "Window \(window.windowID)"
            let appName = application?.applicationName ?? window.owningApplication?.applicationName
            let name = appName.map { "\($0) - \(title)" } ?? title
            return CaptureSourcePayload(
                id: "window:\(window.windowID)",
                name: name,
                kind: "window",
                width: Int(window.frame.width.rounded()),
                height: Int(window.frame.height.rounded()),
                appName: appName,
                bundleIdentifier: application?.bundleIdentifier ?? window.owningApplication?.bundleIdentifier,
                processId: window.owningApplication.map { Int($0.processID) }
            )
        }

        let applications = content.applications.map { application in
            CaptureSourcePayload(
                id: "application:\(application.processID)",
                name: application.applicationName,
                kind: "application",
                width: 0,
                height: 0,
                appName: application.applicationName,
                bundleIdentifier: application.bundleIdentifier,
                processId: Int(application.processID)
            )
        }

        return displays + windows + applications
    }

    static func captureFrame(options: FrameOptions) async throws -> FramePayload {
        let content = try await SCShareableContent.excludingDesktopWindows(
            false,
            onScreenWindowsOnly: true
        )
        let filter = try makeFilter(options: options, content: content)
        let configuration = SCStreamConfiguration()
        configuration.width = options.width
        configuration.height = options.height
        configuration.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale(options.fps))
        configuration.queueDepth = 3
        configuration.showsCursor = options.showsCursor
        if #available(macOS 13.0, *) {
            configuration.capturesAudio = false
        }
        configuration.pixelFormat = kCVPixelFormatType_32BGRA

        let receiver = FrameReceiver(outputPath: options.outputPath)
        let stream = SCStream(filter: filter, configuration: configuration, delegate: receiver)
        try stream.addStreamOutput(receiver, type: .screen, sampleHandlerQueue: receiver.queue)
        try await stream.startCapture()
        do {
            let payload = try await receiver.waitForFrame(timeoutMs: options.timeoutMs)
            try? await stream.stopCapture()
            return payload
        } catch {
            try? await stream.stopCapture()
            throw error
        }
    }

    private static func makeFilter(options: FrameOptions, content: SCShareableContent) throws -> SCContentFilter {
        switch options.kind {
        case "display":
            let displayID = CGDirectDisplayID(try numericId(from: options.id, prefix: "display:"))
            guard let display = content.displays.first(where: { $0.displayID == displayID }) else {
                throw HelperError.sourceNotFound(options.id)
            }
            return SCContentFilter(display: display, excludingWindows: [])
        case "window":
            let windowID = CGWindowID(try numericId(from: options.id, prefix: "window:"))
            guard let window = content.windows.first(where: { $0.windowID == windowID }) else {
                throw HelperError.sourceNotFound(options.id)
            }
            return SCContentFilter(desktopIndependentWindow: window)
        default:
            throw HelperError.invalidArguments("Unsupported frame kind: \(options.kind)")
        }
    }

    private static func numericId(from value: String, prefix: String) throws -> UInt32 {
        guard value.hasPrefix(prefix), let id = UInt32(value.dropFirst(prefix.count)) else {
            throw HelperError.invalidArguments("Invalid source id: \(value)")
        }
        return id
    }
}

@available(macOS 12.3, *)
final class FrameReceiver: NSObject, SCStreamOutput, SCStreamDelegate, @unchecked Sendable {
    let queue = DispatchQueue(label: "app.collabview.capture-helper.frame")
    private let outputPath: String
    private let context = CIContext()
    private var continuation: CheckedContinuation<FramePayload, Error>?
    private var didFinish = false

    init(outputPath: String) {
        self.outputPath = outputPath
    }

    func waitForFrame(timeoutMs: UInt64) async throws -> FramePayload {
        try await withThrowingTaskGroup(of: FramePayload.self) { group in
            group.addTask {
                try await withCheckedThrowingContinuation { continuation in
                    self.queue.async {
                        self.continuation = continuation
                    }
                }
            }
            group.addTask {
                try await Task.sleep(nanoseconds: timeoutMs * 1_000_000)
                throw HelperError.frameTimeout
            }
            guard let result = try await group.next() else {
                throw HelperError.frameTimeout
            }
            group.cancelAll()
            return result
        }
    }

    func stream(
        _ stream: SCStream,
        didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
        of outputType: SCStreamOutputType
    ) {
        guard outputType == .screen, !didFinish else { return }
        guard CMSampleBufferIsValid(sampleBuffer),
              let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            return
        }

        didFinish = true
        do {
            let payload = try writePng(pixelBuffer: pixelBuffer, sampleBuffer: sampleBuffer)
            continuation?.resume(returning: payload)
        } catch {
            continuation?.resume(throwing: error)
        }
        continuation = nil
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        guard !didFinish else { return }
        didFinish = true
        continuation?.resume(throwing: error)
        continuation = nil
    }

    private func writePng(pixelBuffer: CVPixelBuffer, sampleBuffer: CMSampleBuffer) throws -> FramePayload {
        let image = CIImage(cvPixelBuffer: pixelBuffer)
        guard let cgImage = context.createCGImage(image, from: image.extent) else {
            throw HelperError.imageConversionFailed
        }
        let url = URL(fileURLWithPath: outputPath)
        guard let destination = CGImageDestinationCreateWithURL(
            url as CFURL,
            UTType.png.identifier as CFString,
            1,
            nil
        ) else {
            throw HelperError.imageWriteFailed(outputPath)
        }
        CGImageDestinationAddImage(destination, cgImage, nil)
        guard CGImageDestinationFinalize(destination) else {
            throw HelperError.imageWriteFailed(outputPath)
        }
        let timestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
        let timestampNs = UInt64(Double(timestamp.value) / Double(timestamp.timescale) * 1_000_000_000)
        return FramePayload(
            path: outputPath,
            width: CVPixelBufferGetWidth(pixelBuffer),
            height: CVPixelBufferGetHeight(pixelBuffer),
            timestampNs: timestampNs
        )
    }
}
