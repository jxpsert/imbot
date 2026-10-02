# imbot

Receive IM notifications on Discord via a webhook. This bot fetches notifications from the WFS endpoint of Stichting IMN and forwards them to a Discord webhook.

## Install

1. Clone the repository:

   ```bash
   git clone https://github.com/jxpsert/imbot.git
   cd imbot
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Copy the `.env.example` file to `.env` and fill in the required values:

    ```bash
    cp .env.example .env
    ```

4. Start the bot:

    ```bash
    node index.js
    ```

## Configuration

The following settings can be configured using the `.env` file:

- `IM_WFS_HOST`: The WFS endpoint for IM meldingen, without query parameters.
- `IM_WFS_POLL_RATE`: The polling rate in seconds. How often the bot should check for new meldingen.
- `IM_QUERY_CITIES`: A comma-separated list of cities to filter meldingen by. Leave empty to receive all.
- `PHOTON_HOST`: The Photon geocoding service endpoint. Used to get street names from coordinates.
- `WEBHOOK_URL`: The Discord webhook URL to send meldingen to.
