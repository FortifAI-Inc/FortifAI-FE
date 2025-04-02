import { createTheme } from '@aws-amplify/ui-react';

export const amplifyTheme = createTheme({
  name: 'fortifai-theme',
  tokens: {
    colors: {
      brand: {
        primary: {
          10: '#1976d2',
          20: '#1976d2',
          40: '#1976d2',
          60: '#1976d2',
          80: '#1976d2',
          90: '#1976d2',
          100: '#1976d2',
        },
      },
    },
    components: {
      button: {
        primary: {
          backgroundColor: '#1976d2',
          _hover: {
            backgroundColor: '#1565c0',
          },
        },
      },
      heading: {
        color: '#1976d2',
      },
    },
  },
}); 