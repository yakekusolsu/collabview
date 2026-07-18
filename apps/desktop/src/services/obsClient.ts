import OBSWebSocket from "obs-websocket-js";

export interface ObsScene {
  sceneName: string;
}

export interface ObsConnectionResult {
  obsVersion: string;
  obsWebSocketVersion: string;
}

export type ObsConflictChoice = "use" | "alias" | "cancel";

export interface ObsSetupScene {
  key: "self" | "player1" | "player2" | "player3" | "player4" | "split2" | "split4";
  sceneName: string;
}

export interface ObsSetupResult {
  scenes: ObsSetupScene[];
  inputs: string[];
}

export interface ObsSetupParticipant {
  displayName: string;
  obsUrl: string;
}

interface ObsInputSummary {
  inputName: string;
}

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const MEDIA_INPUT_KIND = "ffmpeg_source";

export class ObsClient {
  private readonly client = new OBSWebSocket();
  private reconnectTimer: number | undefined;
  private lastUrl = "";
  private lastPassword: string | undefined;

  async connect(host: string, port: number, password?: string): Promise<ObsConnectionResult> {
    this.lastUrl = `ws://${host}:${port}`;
    this.lastPassword = password;
    const response = await this.client.connect(this.lastUrl, password);
    const version = await this.client.call("GetVersion");
    return {
      obsVersion: version.obsVersion,
      obsWebSocketVersion: response.obsWebSocketVersion
    };
  }

  disconnect(): void {
    window.clearTimeout(this.reconnectTimer);
    void this.client.disconnect();
  }

  async reconnect(delayMs: number): Promise<void> {
    window.clearTimeout(this.reconnectTimer);
    await new Promise<void>((resolve) => {
      this.reconnectTimer = window.setTimeout(resolve, delayMs);
    });
    await this.client.connect(this.lastUrl, this.lastPassword);
  }

  async getScenes(): Promise<ObsScene[]> {
    const response = await this.client.call("GetSceneList");
    return response.scenes.flatMap((scene) =>
      typeof scene.sceneName === "string" ? [{ sceneName: scene.sceneName }] : []
    );
  }

  async getCurrentProgramScene(): Promise<string> {
    const response = await this.client.call("GetCurrentProgramScene");
    return response.currentProgramSceneName;
  }

  async setCurrentProgramScene(sceneName: string): Promise<void> {
    await this.client.call("SetCurrentProgramScene", { sceneName });
  }

  async getSceneItems(sceneName: string): Promise<unknown> {
    return this.client.call("GetSceneItemList", { sceneName });
  }

  async setSceneItemEnabled(
    sceneName: string,
    sceneItemId: number,
    sceneItemEnabled: boolean
  ): Promise<void> {
    await this.client.call("SetSceneItemEnabled", { sceneName, sceneItemId, sceneItemEnabled });
  }

  async setupCollabViewScenes(
    participants: ObsSetupParticipant[],
    resolveConflict: (name: string, kind: "scene" | "input") => ObsConflictChoice
  ): Promise<ObsSetupResult> {
    const sceneNames = new Set((await this.getScenes()).map((scene) => scene.sceneName));
    const inputNames = new Set((await this.getInputNames()).values());
    const usableParticipants = participants.slice(0, 4);
    const createdOrUsedInputs: string[] = [];
    const resultScenes: ObsSetupScene[] = [];

    const selfScene = await this.ensureScene("CollabView - 自分視点", sceneNames, resolveConflict);
    resultScenes.push({ key: "self", sceneName: selfScene });

    const participantSources: string[] = [];
    for (const [index, participant] of usableParticipants.entries()) {
      const sceneName = await this.ensureScene(
        `CollabView - ${participant.displayName}`,
        sceneNames,
        resolveConflict
      );
      resultScenes.push({
        key: `player${index + 1}` as ObsSetupScene["key"],
        sceneName
      });

      const inputName = await this.ensureMediaInput(
        `CollabView Source - ${participant.displayName}`,
        sceneName,
        participant.obsUrl,
        inputNames,
        resolveConflict
      );
      createdOrUsedInputs.push(inputName);
      participantSources.push(inputName);
      const itemId = await this.ensureSceneItem(sceneName, inputName);
      await this.setSceneItemBounds(sceneName, itemId, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    if (participantSources.length >= 2) {
      const split2Scene = await this.ensureScene("CollabView - 2分割", sceneNames, resolveConflict);
      resultScenes.push({ key: "split2", sceneName: split2Scene });
      await this.placeSources(split2Scene, participantSources.slice(0, 2), [
        [0, 0, CANVAS_WIDTH / 2, CANVAS_HEIGHT],
        [CANVAS_WIDTH / 2, 0, CANVAS_WIDTH / 2, CANVAS_HEIGHT]
      ]);
    }

    if (participantSources.length >= 4) {
      const split4Scene = await this.ensureScene("CollabView - 4分割", sceneNames, resolveConflict);
      resultScenes.push({ key: "split4", sceneName: split4Scene });
      await this.placeSources(split4Scene, participantSources.slice(0, 4), [
        [0, 0, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2],
        [CANVAS_WIDTH / 2, 0, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2],
        [0, CANVAS_HEIGHT / 2, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2],
        [CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2]
      ]);
    }

    return {
      scenes: resultScenes,
      inputs: createdOrUsedInputs
    };
  }

  private async getInputNames(): Promise<Set<string>> {
    const response = await this.client.call("GetInputList");
    return new Set(
      response.inputs
        .map((input) => toObsInputSummary(input))
        .flatMap((input) => (input ? [input.inputName] : []))
    );
  }

  private async ensureScene(
    requestedName: string,
    sceneNames: Set<string>,
    resolveConflict: (name: string, kind: "scene") => ObsConflictChoice
  ): Promise<string> {
    if (!sceneNames.has(requestedName)) {
      await this.client.call("CreateScene", { sceneName: requestedName });
      sceneNames.add(requestedName);
      return requestedName;
    }

    const choice = resolveConflict(requestedName, "scene");
    if (choice === "cancel") throw new Error("OBS自動セットアップをキャンセルしました。");
    if (choice === "use") return requestedName;

    const alias = uniqueName(requestedName, sceneNames);
    await this.client.call("CreateScene", { sceneName: alias });
    sceneNames.add(alias);
    return alias;
  }

  private async ensureMediaInput(
    requestedName: string,
    sceneName: string,
    obsUrl: string,
    inputNames: Set<string>,
    resolveConflict: (name: string, kind: "input") => ObsConflictChoice
  ): Promise<string> {
    if (!inputNames.has(requestedName)) {
      await this.client.call("CreateInput", {
        sceneName,
        inputName: requestedName,
        inputKind: MEDIA_INPUT_KIND,
        inputSettings: mediaSourceSettings(obsUrl),
        sceneItemEnabled: true
      });
      inputNames.add(requestedName);
      return requestedName;
    }

    const choice = resolveConflict(requestedName, "input");
    if (choice === "cancel") throw new Error("OBS自動セットアップをキャンセルしました。");
    if (choice === "use") return requestedName;

    const alias = uniqueName(requestedName, inputNames);
    await this.client.call("CreateInput", {
      sceneName,
      inputName: alias,
      inputKind: MEDIA_INPUT_KIND,
      inputSettings: mediaSourceSettings(obsUrl),
      sceneItemEnabled: true
    });
    inputNames.add(alias);
    return alias;
  }

  private async ensureSceneItem(sceneName: string, sourceName: string): Promise<number> {
    try {
      const response = await this.client.call("GetSceneItemId", { sceneName, sourceName });
      return response.sceneItemId;
    } catch {
      const response = await this.client.call("CreateSceneItem", {
        sceneName,
        sourceName,
        sceneItemEnabled: true
      });
      return response.sceneItemId;
    }
  }

  private async placeSources(
    sceneName: string,
    sourceNames: string[],
    boxes: Array<[number, number, number, number]>
  ): Promise<void> {
    for (const [index, sourceName] of sourceNames.entries()) {
      const box = boxes[index];
      if (!box) continue;
      const itemId = await this.ensureSceneItem(sceneName, sourceName);
      const [x, y, width, height] = box;
      await this.setSceneItemBounds(sceneName, itemId, x, y, width, height);
    }
  }

  private async setSceneItemBounds(
    sceneName: string,
    sceneItemId: number,
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<void> {
    await this.client.call("SetSceneItemTransform", {
      sceneName,
      sceneItemId,
      sceneItemTransform: {
        positionX: x,
        positionY: y,
        boundsWidth: width,
        boundsHeight: height,
        boundsType: "OBS_BOUNDS_SCALE_INNER",
        boundsAlignment: 0,
        alignment: 5
      }
    });
  }
}

function mediaSourceSettings(obsUrl: string): Record<string, boolean | string | number> {
  return {
    is_local_file: false,
    local_file: "",
    input: obsUrl,
    restart_on_activate: true,
    close_when_inactive: false,
    buffering_mb: 1
  };
}

function toObsInputSummary(value: unknown): ObsInputSummary | null {
  if (!value || typeof value !== "object") return null;
  const inputName = (value as { inputName?: unknown }).inputName;
  return typeof inputName === "string" ? { inputName } : null;
}

function uniqueName(baseName: string, existingNames: Set<string>): string {
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${baseName} (${index})`;
    if (!existingNames.has(candidate)) return candidate;
  }
  return `${baseName} (${Date.now()})`;
}

export function describeObsError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("authentication")) return "OBS WebSocketのパスワードが違います。";
    if (message.includes("econnrefused") || message.includes("failed to fetch")) {
      return "OBSが起動していない、またはOBS WebSocketが有効ではありません。";
    }
    return error.message;
  }
  return "OBSへの接続中に不明なエラーが発生しました。";
}
