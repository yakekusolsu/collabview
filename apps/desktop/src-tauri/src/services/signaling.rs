use crate::{
    error::{AppError, AppResult},
    models::{
        CreateRoomCodeRequest, CreateRoomCodeResult, JoinRoomCodeRequest, JoinRoomCodeResult,
        ListRoomParticipantsRequest, ListRoomParticipantsResult,
    },
};
use reqwest::{Client, StatusCode, Url};
use serde::{Deserialize, Serialize};
use std::time::Duration;

pub async fn create_room_code(request: CreateRoomCodeRequest) -> AppResult<CreateRoomCodeResult> {
    let client = client()?;
    let url = endpoint(&request.signaling_url, "rooms")?;
    let payload = CreateRoomPayload {
        transport_mode: request.transport_mode,
        host_address: request.host_address.trim().to_string(),
        host_port: request.host_port,
    };
    let response = client
        .post(url)
        .json(&payload)
        .send()
        .await
        .map_err(signaling_error)?;
    read_json(response, "参加コードを発行できませんでした").await
}

pub async fn join_room_code(request: JoinRoomCodeRequest) -> AppResult<JoinRoomCodeResult> {
    let client = client()?;
    let url = endpoint(&request.signaling_url, "rooms/join")?;
    let payload = JoinRoomPayload {
        room_code: request.room_code.trim().to_uppercase(),
        display_name: request.display_name.trim().to_string(),
    };
    let response = client
        .post(url)
        .json(&payload)
        .send()
        .await
        .map_err(signaling_error)?;
    read_json(response, "参加コードから接続先を取得できませんでした").await
}

pub async fn list_room_participants(
    request: ListRoomParticipantsRequest,
) -> AppResult<ListRoomParticipantsResult> {
    let client = client()?;
    let mut url = endpoint(
        &request.signaling_url,
        &format!(
            "rooms/{}/participants",
            request.room_code.trim().to_uppercase()
        ),
    )?;
    url.query_pairs_mut()
        .append_pair("hostToken", request.host_token.trim());
    let response = client.get(url).send().await.map_err(signaling_error)?;
    read_json(response, "参加者一覧を取得できませんでした").await
}

fn client() -> AppResult<Client> {
    Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| AppError::Signaling(error.to_string()))
}

fn endpoint(base_url: &str, path: &str) -> AppResult<Url> {
    let trimmed = base_url.trim().trim_end_matches('/');
    let base = Url::parse(&format!("{trimmed}/"))
        .map_err(|_| AppError::Signaling("シグナリングサーバーURLが無効です".to_string()))?;
    if !matches!(base.scheme(), "http" | "https") {
        return Err(AppError::Signaling(
            "シグナリングサーバーURLはhttpまたはhttpsで指定してください".to_string(),
        ));
    }
    base.join(path)
        .map_err(|error| AppError::Signaling(error.to_string()))
}

async fn read_json<T: for<'de> Deserialize<'de>>(
    response: reqwest::Response,
    fallback_message: &str,
) -> AppResult<T> {
    let status = response.status();
    if !status.is_success() {
        let error_body = response.json::<ErrorBody>().await.ok();
        let code = error_body
            .and_then(|body| body.error)
            .unwrap_or_else(|| status_label(status));
        return Err(AppError::Signaling(format!("{fallback_message} ({code})")));
    }
    response
        .json::<T>()
        .await
        .map_err(|error| AppError::Signaling(error.to_string()))
}

fn signaling_error(error: reqwest::Error) -> AppError {
    if error.is_timeout() {
        AppError::Signaling("シグナリングサーバーへの接続がタイムアウトしました".to_string())
    } else if error.is_connect() {
        AppError::Signaling("シグナリングサーバーへ接続できませんでした".to_string())
    } else {
        AppError::Signaling(error.to_string())
    }
}

fn status_label(status: StatusCode) -> String {
    format!("HTTP {}", status.as_u16())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CreateRoomPayload {
    transport_mode: String,
    host_address: String,
    host_port: u16,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct JoinRoomPayload {
    room_code: String,
    display_name: String,
}

#[derive(Debug, Deserialize)]
struct ErrorBody {
    error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_endpoint_without_health_suffix() {
        let url = endpoint("http://example.com:8787", "rooms").expect("url should be valid");
        assert_eq!(url.as_str(), "http://example.com:8787/rooms");
    }

    #[test]
    fn rejects_non_http_signaling_url() {
        assert!(endpoint("file:///tmp/socket", "rooms").is_err());
    }
}
