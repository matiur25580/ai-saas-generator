# 🚀 AI SaaS Generator

An advanced, full-stack AI content generation application built with Node.js, Express, Mongoose, and MongoDB Atlas. This application allows users to generate customized AI responses based on specific personas and tones, with all generated history stored permanently in a cloud database.

---

## ✨ Features

* **AI Content Generation**: Generates structured AI responses dynamically based on user prompts, selected personas, and tones.
* **Persistent Database Storage**: Automatically saves all generated content securely to **MongoDB Atlas** using **Mongoose**.
* **Full CRUD Operations**: Supports creating, reading, updating, and deleting (CRUD) generated contents via robust backend REST APIs.
* **CORS Enabled**: Seamless communication between the frontend interface and the Express backend.

---

## 🛠️ Tech Stack

* **Frontend**: HTML5, CSS3, JavaScript (or your specific frontend stack)
* **Backend**: Node.js, Express.js
* **Database**: MongoDB Atlas, Mongoose ODM
* **Environment Management**: dotenv

---

## ⚙️ Getting Started & Installation

To run this project locally, follow these steps:

### 1. Clone the repository
```bash
git clone [https://github.com/YOUR_USERNAME/ai-saas-generator.git](https://github.com/YOUR_USERNAME/ai-saas-generator.git)
cd ai-saas-generator
2. Setup Backend
Navigate to the backend directory and install dependencies:
cd backend
npm install

3. Configure Environment Variables
Create a .env file inside the backend directory and add your credentials:
PORT=5000
MONGO_URI=your_mongodb_atlas_connection_string_here

4. Run the Server
node server.js

The server will start successfully on port 5000 (or 5001) and establish a connection with MongoDB Atlas.
📡 API Endpoints
 * POST /api/generate - Generates AI content and saves it to MongoDB Atlas.
 * DELETE /api/content/:id - Deletes specific content by its unique ID.
 * PUT /api/content/:id - Updates existing content by ID.
👨‍💻 Author
Matiur Rahman

