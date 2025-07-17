# Firebase Studio

This is a NextJS starter in Firebase Studio.

## Getting Started

To get started, take a look at `src/app/page.tsx`.

## Local Development

1.  **Create an environment file:** Copy `.env.local.example` to a new file named `.env.local`.

    ```bash
    cp .env.local.example .env.local
    ```

2.  **Fill in the environment variables:** You will need to create OAuth credentials in the Google Cloud Console and add the Client ID, Client Secret, and your local development base URL (e.g., `http://localhost:9002`) to the `.env.local` file. You also need to add a secret for `iron-session` to encrypt cookies. You can generate a new one by running `openssl rand -base64 32` in your terminal.

3.  **Run the development server:**

    ```bash
    npm run dev
    ```
