import React from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import Layout from '../components/Layout';

const Dashboard = () => {
  return (
    <Layout>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6} lg={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6">Total Assets</Typography>
              <Typography variant="h3">24</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6">AI Instances</Typography>
              <Typography variant="h3">2</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6">Security Score</Typography>
              <Typography variant="h3">85%</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6">Active Alerts</Typography>
              <Typography variant="h3">3</Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Layout>
  );
};

export default Dashboard; 