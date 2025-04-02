import React from 'react';
import { useRouter } from 'next/router';
import { Amplify } from 'aws-amplify';
import { withAuthenticator, Heading, View } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import awsConfig from '../aws-exports';
import { Box, Typography } from '@mui/material';
import Image from 'next/image';

Amplify.configure(awsConfig);

// Development bypass authentication
const mockUser = {
  username: 'test@example.com',
  attributes: {
    email: 'test@example.com',
  },
  signInUserSession: {
    accessToken: {
      jwtToken: 'development-bypass-token',
    },
    idToken: {
      jwtToken: 'development-bypass-token',
    },
    refreshToken: {
      token: 'development-bypass-token',
    },
  },
};

// Override the signIn method
Amplify.Auth.signIn = async (username: string, password: string) => {
  return mockUser;
};

// Override the currentSession method
Amplify.Auth.currentSession = async () => {
  return mockUser.signInUserSession;
};

// Override the currentAuthenticatedUser method
Amplify.Auth.currentAuthenticatedUser = async () => {
  return mockUser;
};

const LoginPage = () => {
  const router = useRouter();

  React.useEffect(() => {
    // Redirect to dashboard if already authenticated
    const checkAuth = async () => {
      try {
        const session = await Amplify.Auth.currentSession();
        if (session) {
          router.push('/dashboard');
        }
      } catch (error) {
        // Not authenticated, stay on login page
      }
    };
    checkAuth();
  }, [router]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Image
          src="/images/logo.jpg"
          alt="FortifAI Logo"
          width={120}
          height={120}
          style={{ marginBottom: 16 }}
        />
        <Typography variant="h3" component="h1" gutterBottom>
          FortifAI
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Security Posture Management
        </Typography>
      </Box>
    </Box>
  );
};

const components = {
  Header() {
    return (
      <View textAlign="center" padding="1rem">
        <Image
          src="/images/logo.jpg"
          alt="FortifAI Logo"
          width={80}
          height={80}
          style={{ marginBottom: 8 }}
        />
        <Heading level={2}>FortifAI</Heading>
        <Heading level={4}>Security Posture Management</Heading>
      </View>
    );
  },
};

export default withAuthenticator(LoginPage, {
  signUpAttributes: ['email'],
  socialProviders: ['google'],
  variation: 'modal',
  components,
}); 