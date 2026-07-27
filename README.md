# CollabView

CollabViewは、複数人のゲーム配信で参加者の視点を低遅延に共有し、配信者がOBS Studioのシーンをワンクリックで切り替えるためのmacOSデスクトップアプリです。

## 現在の実装範囲

v0.1.0の土台として、次を実装しています。

- Tauri 2 + Rust + Vue 3 + TypeScript + Vite
- 配信者モードと参加者モードのUI
- OBS 28以降のobs-websocket 5.x接続、シーン取得、シーン切り替え
- OBSパスワードのmacOS Keychain保存
- Application Supportへのユーザー設定保存
- FFmpeg引数の安全な生成
- FFmpegプロセス管理
- SRT URL生成、latencyミリ秒からFFmpeg/SRT向けマイクロ秒への変換
- SRT passphrase/PBKEYLEN検証
- 配信者側のSRT受信、OBS向けローカルSRT再出力、JPEGプレビュー更新
- 参加者側OBS WebSocket接続と、参加者OBSからCollabViewへのSRT入力転送
- OBSシーン自動作成、参加者単独シーン、2分割、4分割
- Command+1〜6のグローバルショートカット
- シグナリングサーバーによる6文字の参加コード発行と接続先解決
- インターネットrelay用のSRT Publish/Pull URL発行
- 同梱FFmpeg/libsrtによる720p60 SRTループバック検証スクリプト
- 基本ログと診断情報
- Vitest、Rust unit test、GitHub Actions
- `.app`/`.dmg`向けTauri設定、`.pkg`作成スクリプト

未完成または実機検証が必要な部分は次です。

- Apple Silicon実機での連続ScreenCaptureKitフレームを使った720p60送信
- OBS認証済み環境でのメディアソース再生確認
- Intel Mac向けFFmpeg sidecarビルド
- relayサーバー上の長時間運用、監視、自動復旧、負荷試験
- UDP到達性がない回線向けのWebRTC/QUICフォールバック
- 署名、公証、Stapling

未完成機能は完成済みとして表示しません。現在の参加者モードのキャプチャ対象は、FFmpeg接続テストへ進むための入口です。

## 必要環境

- macOS 12.3以降
- Apple Silicon Macを優先
- Intel Macはv0.2.0以降で検証予定
- Windows 10/11 x64はNSIS形式の`.exe`インストーラー生成に対応
- Node.js 24
- pnpm 11
- Rust stable
- OBS Studio 28以降
- SRT対応FFmpeg

ScreenCaptureKitはmacOS 12.3以降が必要です。Tauri自体はより古いmacOSも対象にできますが、CollabViewは画面共有要件に合わせて12.3以上を最低対応にします。

Windows版のv0.1.xでは、参加者OBS入力モード、OBS操作、SRT受信/OBS向け再出力、設定UI、ログ、同梱FFmpeg sidecarのビルド導線を優先します。参加者側のWindows画面/ウィンドウキャプチャは、ScreenCaptureKitではなくWindows Graphics CaptureまたはFFmpeg `gdigrab`/`ddagrab`を検証してから有効化します。Windows参加者は、まずOBSでゲーム画面をキャプチャし、OBSのSRT出力をCollabViewへ渡す構成を使います。

## OBS Studioの設定

1. OBS Studio 28以降を起動します。
2. ツールからWebSocketサーバー設定を開きます。
3. WebSocketサーバーを有効にします。
4. ポートは初期値の`4455`を使用します。
5. パスワードを設定します。
6. CollabViewの設定画面で`127.0.0.1:4455`とパスワードを保存します。

パスワードは平文ファイルに保存せず、macOS Keychainへ保存します。ログにも出力しません。

## 配信者モード

1. CollabViewを起動します。
2. 「配信者として開始」を押します。
3. OBSへ接続します。
4. 参加者を選び、「受信開始」を押します。
5. 参加者用の「受信開始」を押します。
6. 必要に応じて「参加コードを発行」を押します。
7. OBSにメディアソースを追加し、OBS追加用URLを指定します。
8. CollabViewのシーンボタンまたはシーン選択からOBSの表示を切り替えます。

「OBSへ自動セットアップ」を押すと、次のシーンと参加者用メディアソースを作成します。

- `CollabView - 自分視点`
- `CollabView - Player 1`
- `CollabView - Player 2`
- `CollabView - Player 3`
- `CollabView - 2分割`
- `CollabView - 4分割`

同名シーンまたはソースがある場合は、既存項目を使用するか、別名で作るか、キャンセルするかを選べます。

初期ショートカット:

- `Command+1`: 自分視点
- `Command+2`: Player 1
- `Command+3`: Player 2
- `Command+4`: Player 3
- `Command+5`: 2分割
- `Command+6`: 4分割

ショートカットは設定画面で変更できます。他アプリが同じキーを使用している場合、登録できないことがあります。

参加コードを使う場合は、シグナリングサーバーが必要です。配信者Mac自身で動かす場合:

```bash
HOST=0.0.0.0 PORT=8787 pnpm --filter @collabview/signaling-server dev
```

設定画面で次を指定します。

- シグナリングサーバーURL: `http://<配信者MacのLAN IP>:8787`
- 配信者LANアドレス: `<配信者MacのLAN IP>`

同一LANでは、参加コードは参加者へSRT送信先のIPとポートを直接伝えないための仕組みです。インターネット越しでは、次のrelay構成を使います。

## インターネットrelay

東京、愛知、大阪など別回線の参加者を接続する場合は、公開IPまたはDNS名を持つrelayサーバーを用意します。

```text
参加者OBS → 参加者CollabView → SRT Publish → relayサーバー → SRT Pull → 配信者CollabView → 配信者OBS
```

relayサーバーでシグナリングサーバーを起動する例:

```bash
COLLABVIEW_RELAY_PUBLIC_HOST=relay.example.com \
COLLABVIEW_RELAY_INGEST_START_PORT=10000 \
COLLABVIEW_RELAY_EGRESS_START_PORT=20000 \
COLLABVIEW_RELAY_LATENCY_MS=500 \
COLLABVIEW_RELAY_PBKEYLEN=16 \
HOST=0.0.0.0 \
PORT=8787 \
pnpm --filter @collabview/signaling-server dev
```

サーバー側でFFmpeg中継プロセスも自動起動する場合:

```bash
COLLABVIEW_RELAY_AUTOSTART_FFMPEG=1 \
COLLABVIEW_RELAY_FFMPEG_PATH=/usr/local/bin/ffmpeg \
COLLABVIEW_RELAY_PUBLIC_HOST=relay.example.com \
HOST=0.0.0.0 \
PORT=8787 \
pnpm --filter @collabview/signaling-server dev
```

開放が必要なポート:

- TCP `8787`: シグナリングAPI
- UDP `10000`以降: 参加者Publish用SRT
- UDP `20000`以降: 配信者Pull用SRT

配信者側の設定:

- 接続方式: `インターネットrelay`
- シグナリングサーバーURL: `http://relay.example.com:8787`

配信者は参加コードを発行し、参加者が入った後に「relay参加者を同期」を押します。その後、対象参加者で「受信開始」を押すと、relayから受信してOBS向けの`127.0.0.1` SRTへ再出力します。

## 参加者モード

1. CollabViewを起動します。
2. 「参加者として開始」を押します。
3. 表示名を入力します。
4. 参加コードを入力し、「接続先を取得」を押します。
5. 共有方法、共有対象、品質を選択します。
6. 「送信開始」を押します。

参加コードがrelayモードの場合、参加者は配信者MacのIPへ直接接続せず、relayサーバーへSRT送信します。参加コードが使えない場合は、手動接続として配信者MacのIPアドレスとポートを直接入力できます。

## 参加者OBS入力モード

東京、愛知、大阪など離れた場所の参加者がそれぞれOBSを使う場合は、このモードを使います。参加者OBSでゲーム画面を作り、OBSからローカルのCollabViewへSRTで渡し、CollabViewがrelayサーバーへ転送します。

```text
参加者OBSのゲームキャプチャ
→ OBS SRT出力
→ 参加者PCのCollabView
→ インターネットrelay
→ 配信PCのCollabView
→ 配信PCのOBSメディアソース
→ YouTubeなどへ生配信
```

参加者側の手順:

1. 参加者PCでOBS Studioを起動します。
2. OBSのWebSocketサーバーを有効にします。
3. CollabViewの設定画面でOBSのホスト、ポート、パスワードを保存します。
4. 参加者モードで共有方法を「参加者OBSから受け取る」にします。
5. 「OBS WebSocketへ接続」を押し、OBSバージョンや現在シーンが表示されることを確認します。
6. 配信者からもらった参加コードを入力し、「接続先を取得」を押します。
7. CollabViewに表示されるOBS向けSRT URLをコピーします。
8. 参加者OBSの出力先をそのSRT URLに設定します。
9. CollabViewで「OBS入力転送開始」を押します。
10. 参加者OBS側でSRT出力を開始します。

OBSへ設定するURL例:

```text
srt://127.0.0.1:15001?mode=caller&latency=250000&transtype=live
```

このモードではCollabView側で再エンコードせず、OBSから来たH.264/MPEG-TSをrelayへコピー転送します。Windows参加者は、v0.1.xではこのOBS入力モードを推奨します。

## シグナリングサーバー

初期版のシグナリングサーバーは、参加コードから配信者のSRT接続先を解決するための軽量サーバーです。映像、音声、OBSパスワードは保存しません。

開発起動:

```bash
pnpm --filter @collabview/signaling-server dev
```

同一LANの別Macからアクセスさせる場合:

```bash
HOST=0.0.0.0 PORT=8787 pnpm --filter @collabview/signaling-server dev
```

参加者側の設定画面では、`http://<シグナリングサーバーのLAN IP>:8787`を指定します。`COLLABVIEW_ALLOWED_ORIGINS`で許可Originを絞れます。

初期設定ではマイク音声を送信しません。Discord通話を使う場合、ゲーム音やマイク音を二重に送らないよう注意してください。

## macOS権限

画面共有には画面収録権限が必要です。

システム設定 → プライバシーとセキュリティ → 画面収録とシステムオーディオ録音 → CollabViewを許可

権限変更後はアプリ再起動が必要になる場合があります。マイク音声を送る場合のみマイク権限が必要です。

## FFmpeg

正式配布では、Homebrewをエンドユーザー必須にしないため、Tauri sidecarとしてFFmpegを同梱します。Apple Silicon向けには`scripts/build-minimal-ffmpeg-sidecar.sh`でCollabView専用の最小FFmpegをビルドします。

現在の最小sidecarは次を有効化します。

- `avfoundation`入力
- `h264_videotoolbox`エンコーダ
- `mpegts` mux/demux
- `libsrt` protocol
- `h264` decoder
- `mjpeg` encoder and `image2` muxer for broadcaster previews
- `lavfi` input and `testsrc2` filter for loopback tests
- `scale`/`fps`/`format` filter

ビルドマシンには`pkg-config`、`srt`、`openssl@3`が必要です。生成されたFFmpeg本体、`libsrt`、OpenSSL dylibはアプリへ同梱されます。エンドユーザーがHomebrewを入れる必要はありません。

macOSで`FFmpegが起動直後に終了しました: signal: 9 (SIGKILL)`と表示される場合、同梱FFmpeg sidecarまたは依存dylibのコード署名が壊れている可能性が高いです。v0.1.6以降では、minimal FFmpeg sidecarを`install_name_tool`で書き換えた後に再署名し、Release CI内で`codesign --verify`と`ffmpeg -version`を通してから`.dmg`へ入れます。このエラーが出る古い`.dmg`を使っている場合は、最新Releaseの`.dmg`を入れ直してください。

確認例:

```bash
ffmpeg -version
ffmpeg -protocols | grep srt
ffmpeg -encoders | grep videotoolbox
```

sidecar検証:

```bash
pnpm prepare:sidecars
pnpm verify:ffmpeg
```

720p60 SRTループバック検証:

```bash
pnpm test:srt-loopback
```

このテストは、同梱FFmpegだけで`testsrc2`の1280x720/60fps映像をH.264 VideoToolboxでSRT送信し、配信者側リレーがOBS相当のローカルSRT受信ファイルとJPEGプレビューを生成できることを確認します。

## ScreenCaptureKit helper

`apps/capture-helper`はSwift製のTauri sidecarです。macOSのScreenCaptureKitを使い、共有可能なディスプレイ、ウィンドウ、アプリケーションを列挙します。また、選択したディスプレイまたはウィンドウから1フレームをPNGとして取得し、参加者画面のローカルプレビューに表示します。

画面収録権限がない場合、helperはmacOSのTCCエラーを返します。CollabViewはそのエラーを画面に表示し、ユーザーにシステム設定での許可を促します。

## 開発

```bash
pnpm install
pnpm tauri dev
```

製品ビルド:

```bash
pnpm tauri build
```

Windows NSIS `.exe`インストーラー:

```powershell
pnpm install
choco install ffmpeg -y
$env:COLLABVIEW_TARGET_TRIPLE="x86_64-pc-windows-msvc"
$env:COLLABVIEW_WINDOWS_FFMPEG_PATH="C:\ProgramData\chocolatey\lib\ffmpeg\tools\ffmpeg\bin\ffmpeg.exe"
pnpm tauri:build:windows
```

生成物は`target/release/bundle/nsis/`に出力されます。FFmpegをChocolatey以外で用意する場合は、`COLLABVIEW_WINDOWS_FFMPEG_PATH`に`ffmpeg.exe`の絶対パスを指定してください。

### Windowsで`.exe`がブロックされる場合

GitHub Releasesやブラウザからダウンロードした未署名の`.exe`には、Windowsがインターネット由来の印を付けます。未署名ビルドではSmartScreenやDefenderにより「指定されたデバイス、パス、またはファイルにアクセスできません」と表示されることがあります。これはCollabViewの設定ではなく、配布ファイルのコード署名とWindows側の保護機能の問題です。

一時的には、ダウンロードしたファイルに対して次を一度だけ実行します。

```powershell
$path="$env:USERPROFILE\Downloads\CollabView_0.1.6_x64-setup.exe"
Get-FileHash $path -Algorithm SHA256
Unblock-File $path
Start-Process $path
```

正式配布ではWindowsコード署名証明書でAuthenticode署名した`.exe`を配布します。GitHub Actionsは次のSecretsが設定されている場合、自動でNSISインストーラーへ署名します。

- `WINDOWS_CODESIGN_CERTIFICATE`: PFX証明書をBase64化した文字列
- `WINDOWS_CODESIGN_CERTIFICATE_PASSWORD`: PFX証明書のパスワード

証明書が未設定の場合、リリースは未署名のまま作成されます。未署名リリースは検証用として扱い、DefenderやSmartScreenを無効化する手順は推奨しません。ReleaseにはSHA256チェックサムも添付します。

PKG作成:

```bash
pnpm pkg:mac
```

## 検証コマンド

```bash
pnpm lint
pnpm typecheck
pnpm test
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
```

## DMG

Tauri bundlerで`.app`と`.dmg`を生成します。背景画像や細かいFinderレイアウトは今後調整します。

## PKG

`scripts/build-pkg.sh`は`/Applications/CollabView.app`へインストールする`.pkg`を作成します。ユーザー設定は削除しません。アンインストールは`/Applications/CollabView.app`を削除してください。Application Supportの設定を消したい場合のみ、ユーザー自身で`~/Library/Application Support/app.CollabView.CollabView`相当を削除します。

## 署名と公証

未署名ビルドはmacOS Gatekeeperの警告が出る場合があります。正式配布ではDeveloper ID Application署名、Hardened Runtime、公証、Staplingを使います。秘密情報はGitHub Secretsで渡し、リポジトリへコミットしません。

Tauri 2のmacOS署名は、Keychainに証明書を入れた上で`APPLE_SIGNING_IDENTITY`を指定します。CIでは`.p12`をbase64化した`APPLE_CERTIFICATE`を一時Keychainへimportします。公証はApple ID方式またはApp Store Connect API key方式に対応します。

想定環境変数とSecrets:

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `KEYCHAIN_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_INSTALLER_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`
- `APPLE_API_KEY`
- `APPLE_API_ISSUER`
- `APPLE_API_KEY_PATH`

署名済みDMGを作る例:

```bash
scripts/import-apple-certificate.sh
pnpm tauri build
```

PKGを署名して公証/Stapleする例:

```bash
APPLE_INSTALLER_SIGNING_IDENTITY="Developer ID Installer: Example, Inc. (TEAMID)" \
COLLABVIEW_NOTARIZE_PKG=1 \
pnpm pkg:mac
```

既存のDMG/PKGを公証してStapleする例:

```bash
pnpm notarize:mac
```

## よくあるエラー

- OBSが起動していない: OBSを起動し、WebSocketサーバーを有効にしてください。
- OBSパスワードが違う: 設定画面で保存し直してください。
- 画面収録権限がない: macOSのシステム設定で許可し、アプリを再起動してください。
- FFmpegを起動できない: sidecarの準備状態と実行権限を確認してください。
- VideoToolboxを使用できない: `ffmpeg -encoders`で`h264_videotoolbox`を確認してください。
- SRT接続失敗: ファイアウォール、IPアドレス、ポート、同一LANを確認してください。
- 映像がカクつく: 720p30、4Mbps、SRT latency 500msを試してください。
- 遅延が大きい: ネットワークが安定していればlatencyを250msへ下げてください。
- 音声が二重になる: CollabView側の音声送信を無効にしてください。

## セキュリティ

- OBSパスワードはKeychainへ保存します。
- FFmpegは引数配列で起動し、`shell: true`相当は使いません。
- ローカルWebViewは`127.0.0.1`にバインドします。
- シグナリングサーバーは映像や音声を保存しません。
- relayモードでも映像はディスクへ保存せず、SRTからSRTへ中継します。
- SRT暗号化のpassphraseとPBKEYLENを検証します。
- ルームコードには試行回数制限と期限を設けます。
- 参加コードの有効期限は30分です。

## ロードマップ

v0.1.0:

- Apple Silicon向けLAN内1参加者
- 参加コードによるLAN接続先解決
- relay接続情報の発行
- OBS接続とシーン切り替え
- FFmpeg/SRTパイプラインの実機検証
- `.app`と`.dmg`

v0.2.0:

- 4参加者
- 1080p60
- Windows x64 `.exe`配布の実機検証
- Windows画面キャプチャ方式の選定
- OBSシーン自動作成
- 2分割/4分割
- グローバルショートカット
- `.pkg`
- Intel Mac検証

v0.3.0:

- relayサーバー運用監視
- 複数リージョンrelay
- UDPが塞がれた環境向けフォールバック
- SRT暗号化のUI
- 自動更新
- 署名/公証
