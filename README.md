

<!-- <p align="center"> <a href="http://nestjs.com/" target="blank"><img src="https://github.com/user-attachments/assets/39665bff-a4b3-46ea-9752-2e85b36b7bab" height="300"  alt="Nest Logo" /></a> </p> <p align="center"> A production-ready <a href="http://nodejs.org" target="_blank">Node.js</a> WhatsApp chatbot built with <a href="https://nestjs.com/" target="_blank">NestJS</a>, leveraging the <a href="https://developers.facebook.com/docs/whatsapp/cloud-api" target="_blank">WhatsApp Cloud API</a> for direct integration with WhatsApp, GPT-4o for conversational intelligence and Redis (free tier from Upstash) for context management. </p> -->


## Step-by-Step Guide
For a detailed, step-by-step guide on building this chatbot, check out:

<!-- ### NestJS WhatsApp Chatbot with GPT-4o
[<img width="960" alt="WhatsApp AI Chatbot" src="https://github.com/user-attachments/assets/ed05d93e-613a-41db-8514-b12d722fe246">](https://www.youtube.com/watch?v=Nn9JJ8IdxM8&list=PLX8Kj-tc4dHallx-LJ-5uu894S7f52xIC&index=1)

### Text-To-Image generation with Stable Diffusion model
[<img width="960" alt="WhatsApp AI Chatbot" src="https://github.com/user-attachments/assets/7c164df6-40df-4f15-84a3-32e04f196412">](https://www.youtube.com/watch?v=gxmlZgVjnv8&list=PLX8Kj-tc4dHallx-LJ-5uu894S7f52xIC&index=4) -->

<!-- **Key Features:**

* **GPT-4o Integration:** Utilises the advanced capabilities of GPT-4o for natural language understanding and generation, ensuring engaging and intelligent conversations.
* **Text-To-Image Generation:** Utilises Stability AI's `Stable Diffusion` model for text-to-image generation.
* **Redis for Context:** Stores conversation context in Redis, enabling the chatbot to maintain a cohesive dialogue and provide context-aware responses.
* **NestJS Framework:** Built on the robust and scalable NestJS framework, providing a well-structured and maintainable codebase.
* **Production-Ready:** Designed with production environments in mind, ensuring security, stability, scalability, and reliability. -->

**Getting Started:**

1. **Install Node.js:** Download and install the latest version of Node.js from [https://nodejs.org/](https://nodejs.org/).

2. **Install Dependencies:**

   ```bash
   npm install
   ```

3. **Configure Environment Variables:**

    - Set up environment variables for API keys (OpenAI, Gupshup API provider), database credentials (Redis, Postgres), and other necessary configurations.

4. **Run the Chatbot:**

    - **Development Mode:**
      ```bash
      npm run start:dev
      ```
      This command starts the chatbot in development mode with file watching for changes.

    - **Debug Mode:**
      ```bash
      npm run start:debug
      ```
      This command starts the chatbot in debug mode with file watching for changes, enabling you to use a debugger.

    - **Production Mode:**
      ```bash
      npm run start:prod
      ```
      This command starts the chatbot in production mode, optimized for performance and stability.

## Connecting Your Backend To WhatsApp:

- **No third-party providers needed!** You can directly integrate with the WhatsApp Cloud API by following these steps:
   1. Create a Facebook Developer account at [https://developers.facebook.com/](https://developers.facebook.com/).
   2. Create a WhatsApp Business account and integrate it with your Facebook Developer account.
   3. Follow the official WhatsApp Cloud API documentation to configure your chatbot. (details to be saved to your environment file)


**Testing (Contributions are welcome - running by grace, no tests):**

* **Unit Tests:**

   ```bash
   npm run test
   ```

* **End-to-End (E2E) Tests:**

   ```bash
   npm run test:e2e
   ```

**Support and Contribution:**

We welcome contributions and feedback. If you encounter issues or have suggestions, please open an issue on GitHub.

**Acknowledgements:**

This chatbot is made possible by the incredible work of the following projects:

* [NestJS](https://nestjs.com/)
* [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/)
* [GPT-4o](https://platform.openai.com/docs/models/gpt-4o)
* [Upstash Redis](https://upstash.com/)
* [ioredis](https://github.com/luin/ioredis)
* [openai](https://github.com/openai/openai-node)


**Let's build a smarter and more engaging WhatsApp experience!** 


**Run server locally**

This will allow you to receive webhooks from WhatsApp to your local server.

```bash
ngrok http 3015  (need vpn)
ollama
```


**Waba text msg webhook structure**
```json
{
  request:
    {
      "entry": [
        {
          "changes": [
            {
              "field": "messages",
              "value": {
                "contacts": [
                  {
                    "profile": {
                      "name": "Max"
                    },
                    "wa_id": "79384021087"
                  }
                ],
                "messages": [
                  {
                    "from": "79384021087",
                    "id": "wamid.HBgLNzkzODQwMjEwODcVAgASGBQzQURFODI3OTA3RjA2MEFDQTQ0NwA=",
                    "text": {
                      "body": "hellllo"
                    },
                    "timestamp": "1749457925",
                    "type": "text"
                  }
                ],
                "messaging_product": "whatsapp",
                "metadata": {
                  "display_phone_number": "94741442190",
                  "phone_number_id": "709267392266149"
                }
              }
            }
          ],
          "id": "600101339185613"
        }
      ],
      "gs_app_id": "564d5cff-2892-46dc-874a-6528d602d2b6",
      "object": "whatsapp_business_account"
    }    
}
```

**Inst text msg webhook structure**
```json
{
  "object": "instagram",
  "entry": [
    {
      "time": 1750173841899,
      "id": "17841475555245128",
      "messaging": [
        {
          "sender": {
            "id": "1086037003446445"
          },
          "recipient": {
            "id": "17841475555245128"
          },
          "timestamp": 1750173841164,
          "message": {
            "mid": "aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDc1NTU1MjQ1MTI4OjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxODE3NjE1NDE1Nzg0NjozMjI4NTAwODkzMjQ1NDc1MzQ3Njg0Nzg1NTc3MDUzMzg4OAZDZD",
            "text": "You do?"
          }
        }
      ]
    }
  ]
}
```

+94741442190 Good Story Agent


## Step-by-step: How to Run the Application

### 1. Local Development/Debugging (with hot reload)

1. **Start db and app services in development mode:**
   ```zsh
   docker compose -f docker-compose.dev.yml up -d --build
   ```
   ```zsh
   npm run start:debug
   ```
   - This will start the app in debug mode with hot reload (the app doesn't work yet in the container because of faiss)
   - Any code changes you make will automatically restart the app.

2. **Access your app:**
   - Open [http://localhost:3015](http://localhost:3015) in your browser.

3. **Stop all services:**
   ```zsh
   docker compose -f docker-compose.dev.yml down
   ```

---

### 2. Production Mode (on the server)

1. **Build and start all services in production mode:**
   ```zsh
   docker compose -f docker-compose.prod.yml up --build -d
   ```
   - This will build the dbs stage
   
    ```zsh
   npm run build
   ```

   - Copy env variables and config if necessary

   ```zsh
   pm2 restart your-app || pm2 start dist/main.js --name your-app
   ```
   - The app will run in the background.

2. **Check logs (optional):**
   ```zsh
   docker compose -f docker-compose.prod.yml logs -f app
   ```
   ```zsh
   pm2 logs
    ```

3. **Stop all services:**
   ```zsh
   docker compose -f docker-compose.prod.yml down


look at the db
```bash
docker exec -it gs_wa_agent_psdb psql -U dbuser -h gs_wa_agent_psdb -d gs_wa_agent_db -W
#insert pass
```

```sql
select * from message_history;
select "clientId", "question", "answer" from message_history WHERE "date" > '2025-06-20 00:00:00' and "clientId" = '94774546141' order by "date" asc limit 30;
```

** Insta
17841429102711673 - GSVillage user



