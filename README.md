# Share Files - Basic MERN

Very basic private file application.

## Features

- Secret code
- JWT authentication
- MongoDB file metadata
- File upload API
- File download
- React frontend
- Express backend

## Run backend

cd backend
npm install

Create `.env` from `.env.example` and add your MongoDB Atlas URI.

npm run dev

## Run frontend

cd frontend
npm install
npm run dev

Open:

http://localhost:5173

## Uploading files

The current minimal UI only lists/downloads files. To upload initially, use the API:

POST http://localhost:5001/api/files/upload

with:
Authorization: Bearer YOUR_TOKEN

and multipart form field:

file

## Important

The `uploads` folder is local storage. For production deployment, use S3/Cloudflare R2/another persistent object-storage service instead of local disk.
