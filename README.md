# Audienze - Full Stack Application

A modern React frontend and Node.js backend application, ready for deployment on Vercel and Netlify.

## 🚀 Features

- **React Frontend**: Modern React 18 with hooks and functional components
- **Node.js Backend**: Express.js API with RESTful endpoints
- **Cloud Deployment**: Configured for Vercel and Netlify
- **Responsive Design**: Beautiful, mobile-first UI
- **Development Ready**: Hot reloading and development scripts

## 📁 Project Structure

```
audienze/
├── frontend/          # React application
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── netlify.toml
├── backend/           # Node.js API
│   ├── server.js
│   ├── package.json
│   └── env.example
├── package.json       # Root workspace configuration
├── vercel.json        # Vercel deployment config
├── netlify.toml       # Netlify deployment config
└── README.md
```

## 🛠️ Local Development

### Prerequisites

- Node.js 16+ 
- npm 8+

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd audienze
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Start development servers**
   ```bash
   npm run dev
   ```

This will start:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

### Available Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run dev:frontend` - Start only the React frontend
- `npm run dev:backend` - Start only the Node.js backend
- `npm run build` - Build both applications for production
- `npm run start` - Start production backend server

## ☁️ Deployment

### Vercel Deployment (Recommended for Full Stack)

Vercel is **FREE** for personal projects with generous limits:
- Unlimited personal projects
- 100GB bandwidth per month
- Serverless functions included
- Automatic HTTPS and CDN

#### Steps:

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with GitHub
   - Click "New Project"
   - Import your repository
   - Vercel will automatically detect the configuration from `vercel.json`

3. **Environment Variables** (if needed)
   - In Vercel dashboard, go to Project Settings → Environment Variables
   - Add any variables from `backend/env.example`

### Netlify Deployment (Frontend Only)

Netlify is also **FREE** with excellent features:
- 100GB bandwidth per month
- Unlimited sites
- Form handling
- Edge functions

#### Steps:

1. **Deploy Frontend to Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Sign up with GitHub
   - Click "New site from Git"
   - Choose your repository
   - Set build settings:
     - Build command: `cd frontend && npm install && npm run build`
     - Publish directory: `frontend/build`

2. **Configure API Redirects**
   - In Netlify dashboard, go to Site Settings → Redirects and rewrites
   - Add redirect rule:
     - From: `/api/*`
     - To: `https://your-backend-url.vercel.app/api/:splat`
     - Status: 200

## 💰 Pricing Information

### Vercel (FREE Tier)
- ✅ Unlimited personal projects
- ✅ 100GB bandwidth/month
- ✅ Serverless functions
- ✅ Automatic deployments
- ✅ Custom domains
- ✅ SSL certificates

### Netlify (FREE Tier)
- ✅ Unlimited sites
- ✅ 100GB bandwidth/month
- ✅ Form submissions (100/month)
- ✅ Edge functions
- ✅ Custom domains
- ✅ SSL certificates

**Both platforms offer generous free tiers perfect for personal projects and small businesses!**

## 🔧 Configuration

### Frontend Configuration

The React app is configured to proxy API requests to the backend during development. In production, API calls will be redirected to your deployed backend.

### Backend Configuration

The Express server includes:
- CORS enabled for cross-origin requests
- Helmet for security headers
- Morgan for request logging
- Error handling middleware
- Health check endpoint

### Environment Variables

Copy `backend/env.example` to `backend/.env` and configure:
```env
NODE_ENV=development
PORT=5000
```

## 📡 API Endpoints

- `GET /` - Welcome message
- `GET /api/health` - Health check
- `GET /api/users` - Get all users
- `POST /api/users` - Create new user

## 🎨 Customization

### Styling
- Modify `frontend/src/App.css` for custom styles
- The app uses CSS Grid and Flexbox for responsive design
- Color scheme can be changed in the CSS variables

### Backend Routes
- Add new routes in `backend/server.js`
- Follow the existing pattern for consistency

## 🚀 Next Steps

1. **Add Authentication**: Implement JWT-based auth
2. **Database Integration**: Add MongoDB or PostgreSQL
3. **Testing**: Add Jest tests for both frontend and backend
4. **CI/CD**: Set up GitHub Actions for automated testing
5. **Monitoring**: Add error tracking with Sentry

## 📝 License

MIT License - feel free to use this project as a starting point for your own applications!

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

**Happy coding! 🎉**
