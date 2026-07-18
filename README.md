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
- OBSシーン自動作成、参加者単独シーン、2分割、4分割
- Command+1〜6のグローバルショートカット
- 同梱FFmpeg/libsrtによる720p60 SRTループバック検証スクリプト
- 基本ログと診断情報
- Vitest、Rust unit test、GitHub Actions
- `.app`/`.dmg`向けTauri設定、`.pkg`作成スクリプト

未完成または実機検証が必要な部分は次です。

- Apple Silicon実機での連続ScreenCaptureKitフレームを使った720p60送信
- OBS認証済み環境でのメディアソース再生確認
- Intel Mac向けFFmpeg sidecarビルド
- OBSシーン自動作成
- 署名、公証、Stapling

未完成機能は完成済みとして表示しません。現在の参加者モードのキャプチャ対象は、FFmpeg接続テストへ進むための入口です。

## 必要環境

- macOS 12.3以降
- Apple Silicon Macを優先
- Intel Macはv0.2.0以降で検証予定
- Node.js 24
- pnpm 11
- Rust stable
- OBS Studio 28以降
- SRT対応FFmpeg

ScreenCaptureKitはmacOS 12.3以降が必要です。Tauri自体はより古いmacOSも対象にできますが、CollabViewは画面共有要件に合わせて12.3以上を最低対応にします。

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
5. 参加者用の送信先ポートとOBS追加用URLを確認します。
6. OBSにメディアソースを追加し、OBS追加用URLを指定します。
7. CollabViewのシーンボタンまたはシーン選択からOBSの表示を切り替えます。

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

v0.1.0ではLAN内の手動接続を優先します。ルームコードを使ったインターネット越し接続はv0.3.0の範囲です。

## 参加者モード

1. CollabViewを起動します。
2. 「参加者として開始」を押します。
3. 配信者MacのIPアドレスとポートを入力します。
4. 表示名、共有対象、品質を選択します。
5. 「送信開始」を押します。

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
- SRT暗号化のpassphraseとPBKEYLENを検証します。
- ルームコードには試行回数制限と期限を設けます。

## ロードマップ

v0.1.0:

- Apple Silicon向けLAN内1参加者
- OBS接続とシーン切り替え
- FFmpeg/SRTパイプラインの実機検証
- `.app`と`.dmg`

v0.2.0:

- 4参加者
- 1080p60
- OBSシーン自動作成
- 2分割/4分割
- グローバルショートカット
- `.pkg`
- Intel Mac検証

v0.3.0:

- ルームコード方式
- シグナリングサーバー
- NAT越え/中継
- SRT暗号化のUI
- 自動更新
- 署名/公証
