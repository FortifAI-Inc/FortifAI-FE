import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { Resizable, ResizeCallback } from 're-resizable';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import Layout from '../components/Layout';
import { api } from '../services/api'; // Import the api service
import { CloudTrailCollection } from '../types'; // Import CloudTrailCollection

interface AnalyticsResult {
  seriesId: string;
  analysisTime: string;
  startTime: string;
  endTime: string;
  eventsCount: number;
  results: string;
}

const SecurityAudit: React.FC = () => {
  const [upperHeight, setUpperHeight] = useState(300);
  const [collections, setCollections] = useState<CloudTrailCollection[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResult[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [errorCollections, setErrorCollections] = useState<string | null>(null);

  // State for the "New Collection" dialog
  const [openNewCollectionDialog, setOpenNewCollectionDialog] = useState(false);
  const [newCollectionSeriesId, setNewCollectionSeriesId] = useState('');
  const [newCollectionStartTime, setNewCollectionStartTime] = useState<Date | null>(new Date());
  const [newCollectionEndTime, setNewCollectionEndTime] = useState<Date | null>(new Date());
  const [newCollectionContinuePrevious, setNewCollectionContinuePrevious] = useState(false);
  const [newCollectionError, setNewCollectionError] = useState<string | null>(null);

  const handleResizeStop: ResizeCallback = (e, direction, ref, d) => {
    setUpperHeight(upperHeight + d.height);
  };

  const fetchCollections = async () => {
    setLoadingCollections(true);
    setErrorCollections(null);
    try {
      const data = await api.getCloudTrailCollections();
      setCollections(data);
      console.log("Fetched collections:", data);
    } catch (error) {
      console.error("Error fetching collections:", error);
      setErrorCollections(error instanceof Error ? error.message : "Failed to fetch collections.");
    } finally {
      setLoadingCollections(false);
    }
  };

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      // Placeholder for fetching analytics data
      // const data = await api.getAnalytics();
      // For now, set to empty or handle appropriately if no API exists yet
      setAnalytics([]); // Cleared sample data usage
      console.log("Fetched analytics (cleared sample data)");
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Fetch data on component mount
  React.useEffect(() => {
    fetchCollections();
    fetchAnalytics();
  }, []);

  const handleOpenNewCollectionDialog = () => {
    setOpenNewCollectionDialog(true);
    setNewCollectionError(null); // Clear previous errors
  };

  const handleCloseNewCollectionDialog = () => {
    setOpenNewCollectionDialog(false);
    // Optionally reset form fields
    setNewCollectionSeriesId('');
    setNewCollectionStartTime(new Date());
    setNewCollectionEndTime(new Date());
    setNewCollectionContinuePrevious(false);
  };

  const handleCreateNewCollection = async () => {
    if (!newCollectionSeriesId) {
      setNewCollectionError("Series ID is required.");
      return;
    }
    if (!newCollectionStartTime) {
      setNewCollectionError("Start Time is required.");
      return;
    }
    if (!newCollectionEndTime) {
      setNewCollectionError("End Time is required.");
      return;
    }
    if (newCollectionEndTime <= newCollectionStartTime) {
        setNewCollectionError("End Time must be after Start Time.");
        return;
    }

    setNewCollectionError(null);

    try {
      console.log("Creating new collection with data:", {
        seriesId: newCollectionSeriesId, // Though seriesId is not directly part of the /collect payload
        startTime: newCollectionStartTime.toISOString(),
        endTime: newCollectionEndTime.toISOString(),
        continuePrevious: newCollectionContinuePrevious,
      });
      // The endpoint /api/v1/logs-collector/collect expects startTime, endTime, continuePrevious in the body.
      // The seriesId might be handled differently by the backend or might be implicitly 'main' or a default
      // if not specified, or it might need to be part of a different mechanism if this is a *new* series.
      // For now, we'll assume the `collect` endpoint handles the series context or it's a general collect.
      // If a specific series ID needs to be targeted for a *new* collection *initiation*,
      // the backend endpoint might need adjustment or a different one used.
      // The provided endpoint in instructions is:
      // curl -k -v -X POST -H "Content-Type: application/json" -H "Authorization: Bearer development_token" \\
      // -d \'\'\'{"startTime": "2025-05-23T00:00:00Z", "endTime": "2025-05-24T00:00:00Z", "continuePrevious": false}\'\'\' \\
      // https://a12c65672e20e491e83c7a13c5662714-1758004955.eu-north-1.elb.amazonaws.com/api/v1/logs-collector/collect

      // We'll call a new method in api.ts which will hit the /logs-collector/collect endpoint
      await api.startLogCollection({
        startTime: newCollectionStartTime.toISOString(),
        endTime: newCollectionEndTime.toISOString(),
        continuePrevious: newCollectionContinuePrevious,
        seriesId: newCollectionSeriesId, // Ensure seriesId is passed
      });

      handleCloseNewCollectionDialog();
      fetchCollections(); // Refresh collections list
      // Show success notification
    } catch (error) {
      console.error("Error creating new collection:", error);
      setNewCollectionError(error instanceof Error ? error.message : "Failed to create collection.");
      // Show error notification
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Layout>
        <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', p: 3 }}>
          <Typography variant="h4" gutterBottom>
            Security Audit
          </Typography>

          {/* CloudTrail Collections Grid */}
          <Resizable
            size={{ width: '100%', height: upperHeight }}
            onResizeStop={handleResizeStop}
            enable={{ bottom: true }}
            minHeight={200}
            maxHeight={window.innerHeight - 400}
          >
            <Paper sx={{ height: '100%', mb: 2, overflow: 'hidden' }}>
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">CloudTrail Collections</Typography>
                <Box>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<RefreshIcon />}
                    sx={{ mr: 1 }}
                    onClick={fetchCollections}
                    disabled={loadingCollections}
                  >
                    {loadingCollections ? 'Refreshing...' : 'Refresh'}
                  </Button>
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={handleOpenNewCollectionDialog}
                    sx={{ mr: 1 }}
                  >
                    New Collection
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<FilterListIcon />}
                  >
                    Filter
                  </Button>
                </Box>
              </Box>
              {errorCollections && (
                <Box sx={{ p: 2, pt: 0 }}>
                  <Typography color="error">Error: {errorCollections}</Typography>
                </Box>
              )}
              <TableContainer sx={{ maxHeight: upperHeight - (errorCollections ? 90 : 70) }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Series ID</TableCell>
                      <TableCell>Creation Date</TableCell>
                      <TableCell>Last Update</TableCell>
                      <TableCell>Event Count</TableCell>
                      <TableCell>First Event Time</TableCell>
                      <TableCell>Last Event Time</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Filter</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {collections.map((row) => (
                      <TableRow key={row.seriesId}>
                        <TableCell>{row.seriesId}</TableCell>
                        <TableCell>{new Date(row.creationDate).toLocaleString()}</TableCell>
                        <TableCell>{new Date(row.lastUpdate).toLocaleString()}</TableCell>
                        <TableCell>{row.eventCount}</TableCell>
                        <TableCell>{new Date(row.firstEventTime).toLocaleString()}</TableCell>
                        <TableCell>{new Date(row.lastEventTime).toLocaleString()}</TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell>{row.filter}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Resizable>

          {/* Analytics Grid */}
          <Paper sx={{ flex: 1, overflow: 'hidden' }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Analytics</Typography>
              <Box>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<RefreshIcon />}
                  sx={{ mr: 1 }}
                  onClick={fetchAnalytics}
                  disabled={loadingAnalytics}
                >
                  {loadingAnalytics ? 'Refreshing...' : 'Refresh'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<FilterListIcon />}
                >
                  Filter
                </Button>
              </Box>
            </Box>
            <TableContainer sx={{ maxHeight: 'calc(100% - 70px)' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Series ID</TableCell>
                    <TableCell>Analysis Time</TableCell>
                    <TableCell>Start Time</TableCell>
                    <TableCell>End Time</TableCell>
                    <TableCell>Events Count</TableCell>
                    <TableCell>Results</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analytics.map((row) => (
                    <TableRow key={row.seriesId}>
                      <TableCell>{row.seriesId}</TableCell>
                      <TableCell>{new Date(row.analysisTime).toLocaleString()}</TableCell>
                      <TableCell>{new Date(row.startTime).toLocaleString()}</TableCell>
                      <TableCell>{new Date(row.endTime).toLocaleString()}</TableCell>
                      <TableCell>{row.eventsCount}</TableCell>
                      <TableCell>{row.results}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>

        {/* New Collection Dialog */}
        <Dialog open={openNewCollectionDialog} onClose={handleCloseNewCollectionDialog}>
          <DialogTitle>Create New Log Collection</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{mb: 2}}>
              Specify the details for the new CloudTrail log collection.
              The Series ID is used to identify this collection process.
            </DialogContentText>
            <TextField
              autoFocus
              margin="dense"
              id="seriesId"
              label="Series ID"
              type="text"
              fullWidth
              variant="outlined"
              value={newCollectionSeriesId}
              onChange={(e) => setNewCollectionSeriesId(e.target.value)}
              sx={{ mb: 2 }}
            />
            <DateTimePicker
              label="Start Time"
              value={newCollectionStartTime}
              onChange={(newValue) => setNewCollectionStartTime(newValue)}
              slotProps={{ textField: { fullWidth: true, sx: { mb: 2 } } }}
            />
            <DateTimePicker
              label="End Time"
              value={newCollectionEndTime}
              onChange={(newValue) => setNewCollectionEndTime(newValue)}
              slotProps={{ textField: { fullWidth: true, sx: { mb: 2 } } }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={newCollectionContinuePrevious}
                  onChange={(e) => setNewCollectionContinuePrevious(e.target.checked)}
                  name="continuePrevious"
                />
              }
              label="Continue Previous Collection (if series ID exists)"
              sx={{ mt: 1 }}
            />
            {newCollectionError && (
              <Typography color="error" sx={{ mt: 2 }}>
                {newCollectionError}
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{p: '16px 24px'}}>
            <Button onClick={handleCloseNewCollectionDialog} color="primary">
              Cancel
            </Button>
            <Button onClick={handleCreateNewCollection} variant="contained" color="primary">
              Create
            </Button>
          </DialogActions>
        </Dialog>
      </Layout>
    </LocalizationProvider>
  );
};

export default SecurityAudit; 