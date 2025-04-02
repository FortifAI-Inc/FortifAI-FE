# FortifAI Web Application

A modern web application for FortifAI's Security Posture Management system.

## Features

- AWS Cognito Authentication
- Modern Material-UI based interface
- Interactive environment graph visualization
- Dashboard with key metrics
- Responsive design

## Prerequisites

- Node.js 16.x or later
- npm or yarn
- AWS Cognito User Pool (for authentication)

## Setup

1. Install dependencies:
```bash
npm install
# or
yarn install
```

2. Create a `.env.local` file in the root directory with your AWS Cognito configuration:
```
NEXT_PUBLIC_AWS_REGION=your-region
NEXT_PUBLIC_USER_POOL_ID=your-user-pool-id
NEXT_PUBLIC_USER_POOL_WEB_CLIENT_ID=your-client-id
```

3. Add your company logo:
- Place your logo file at `public/images/logo.jpg`

4. Run the development server:
```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `/src/components` - Reusable React components
- `/src/pages` - Next.js pages
- `/public` - Static assets
- `/src/aws-exports.ts` - AWS Amplify configuration

## Authentication

The application uses AWS Cognito for authentication. Users can:
- Sign up with email
- Sign in with email/password
- Reset password
- Verify email
- Sign in with Google (if configured in Cognito)

## Development

- The application uses TypeScript for type safety
- Material-UI for the component library
- React Force Graph for the environment visualization
- Next.js for the framework

## Building for Production

```bash
npm run build
npm start
# or
yarn build
yarn start
``` 