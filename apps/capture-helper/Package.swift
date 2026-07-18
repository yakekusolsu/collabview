// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "collabview-capture-helper",
    platforms: [.macOS(.v12)],
    products: [
        .executable(name: "collabview-capture-helper", targets: ["CollabViewCaptureHelper"])
    ],
    targets: [
        .executableTarget(
            name: "CollabViewCaptureHelper",
            path: "Sources"
        )
    ]
)
