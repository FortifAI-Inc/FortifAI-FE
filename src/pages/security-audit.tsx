import React, { useState, useEffect, useMemo } from 'react';
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
  Menu,
  MenuItem,
  CircularProgress
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { Resizable, ResizeCallback } from 're-resizable';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import Layout from '../components/Layout';
import { api } from '../services/api'; // Import the api service
import { CloudTrailCollection, AnalyticsResult } from '../types'; // Import CloudTrailCollection AND AnalyticsResult

// Helper to format date for datetime-local input
const formatDateTimeForInput = (isoString: string): string => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    // Format: YYYY-MM-DDTHH:mm
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (e) {
    console.error("Error formatting date for input:", e);
    return ''; // Fallback if parsing fails
  }
};

const SecurityAudit: React.FC = () => {
  const [upperHeight, setUpperHeight] = useState(300);
  const [collections, setCollections] = useState<CloudTrailCollection[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResult[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [errorCollections, setErrorCollections] = useState<string | null>(null);
  const [errorAnalytics, setErrorAnalytics] = useState<string | null>(null);

  // State for the "New Collection" dialog
  const [openNewCollectionDialog, setOpenNewCollectionDialog] = useState(false);
  const [newCollectionSeriesId, setNewCollectionSeriesId] = useState('');
  const [newCollectionStartTime, setNewCollectionStartTime] = useState<Date | null>(new Date());
  const [newCollectionEndTime, setNewCollectionEndTime] = useState<Date | null>(new Date());
  const [newCollectionContinuePrevious, setNewCollectionContinuePrevious] = useState(false);
  const [newCollectionError, setNewCollectionError] = useState<string | null>(null);

  // State for Context Menu
  const [contextMenuAnchorEl, setContextMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedCollectionForMenu, setSelectedCollectionForMenu] = useState<CloudTrailCollection | null>(null);

  // State for Analytics Dialog
  const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false);
  const [analyticsDialogSeriesId, setAnalyticsDialogSeriesId] = useState('');
  const [analyticsDialogStartTime, setAnalyticsDialogStartTime] = useState('');
  const [analyticsDialogEndTime, setAnalyticsDialogEndTime] = useState('');
  const [analyticsDialogError, setAnalyticsDialogError] = useState<string | null>(null);
  const [analyticsSubmitting, setAnalyticsSubmitting] = useState(false);

  // State for analytics filter
  const [selectedSeriesIdForAnalyticsFilter, setSelectedSeriesIdForAnalyticsFilter] = useState<string | null>(null);

  const [viewAnalyticsDialogOpen, setViewAnalyticsDialogOpen] = useState(false);
  const [currentAnalyticsData, setCurrentAnalyticsData] = useState<any>(null);
  const [loadingAnalyticsData, setLoadingAnalyticsData] = useState(false);

  const [windowHeight, setWindowHeight] = useState<number>(800); // Default height

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [analyticsToDelete, setAnalyticsToDelete] = useState<{ seriesId: string; analysisId: string } | null>(null);

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

  const fetchAnalyticsResults = async (seriesIdForFilter?: string | null) => {
    setLoadingAnalytics(true);
    setErrorAnalytics(null);
    try {
      const data = await api.getAnalytics(seriesIdForFilter || undefined);
      setAnalytics(data);
      console.log("Fetched analytics results:", data);
    } catch (error) {
      console.error("Error fetching analytics results:", error);
      setErrorAnalytics(error instanceof Error ? error.message : "Failed to fetch analytics results.");
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Fetch data on component mount
  React.useEffect(() => {
    fetchCollections();
    fetchAnalyticsResults();
  }, []);

  useEffect(() => {
    // Set initial height
    setWindowHeight(window.innerHeight);

    // Update height on resize
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
    setNewCollectionError(null);
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

  // Context Menu Handlers
  const handleContextMenuOpen = (event: React.MouseEvent<HTMLTableRowElement>, collection: CloudTrailCollection) => {
    event.preventDefault();
    setContextMenuAnchorEl(event.currentTarget);
    setSelectedCollectionForMenu(collection);
  };

  const handleContextMenuClose = () => {
    setContextMenuAnchorEl(null);
    setSelectedCollectionForMenu(null);
  };

  // Analytics Dialog Handlers
  const handleOpenAnalyticsDialog = () => {
    if (selectedCollectionForMenu) {
      setAnalyticsDialogSeriesId(selectedCollectionForMenu.seriesId);
      setAnalyticsDialogStartTime(formatDateTimeForInput(selectedCollectionForMenu.firstEventTime));
      setAnalyticsDialogEndTime(formatDateTimeForInput(selectedCollectionForMenu.lastEventTime));
      setAnalyticsDialogOpen(true);
      setAnalyticsDialogError(null);
    }
    handleContextMenuClose(); // Close context menu
  };

  const handleCloseAnalyticsDialog = () => {
    setAnalyticsDialogOpen(false);
    setAnalyticsDialogError(null);
    setAnalyticsSubmitting(false);
  };

  const handleRunAnalyticsSubmit = async () => {
    if (!analyticsDialogStartTime || !analyticsDialogEndTime) {
      setAnalyticsDialogError("Start Time and End Time are required.");
      return;
    }
    const startTime = new Date(analyticsDialogStartTime);
    const endTime = new Date(analyticsDialogEndTime);

    if (endTime <= startTime) {
      setAnalyticsDialogError("End Time must be after Start Time.");
      return;
    }
    setAnalyticsDialogError(null);
    setAnalyticsSubmitting(true);
    try {
      const payload = {
        seriesId: analyticsDialogSeriesId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      };
      console.log("Submitting analytics request:", payload);
      const result = await api.runComputeEventsAnalysis(payload);
      console.log("Analytics submission result:", result);
      // TODO: Handle result - maybe show a notification or update an analytics status table
      handleCloseAnalyticsDialog();

      // Set filter for analytics grid and trigger delayed refresh
      setSelectedSeriesIdForAnalyticsFilter(analyticsDialogSeriesId);

      setTimeout(() => {
        console.log(`Refreshing analytics for ${analyticsDialogSeriesId} after 5s delay.`);
        fetchAnalyticsResults(analyticsDialogSeriesId);
      }, 5000); // 5 seconds delay

    } catch (error) {
      console.error("Error submitting analytics request:", error);
      setAnalyticsDialogError(error instanceof Error ? error.message : "Failed to run analytics.");
    } finally {
      setAnalyticsSubmitting(false);
    }
  };

  // Memoized filtered analytics results
  const filteredAnalytics = useMemo(() => {
    if (!selectedSeriesIdForAnalyticsFilter) {
      return analytics;
    }
    return analytics.filter(analysis => analysis.seriesId === selectedSeriesIdForAnalyticsFilter);
  }, [analytics, selectedSeriesIdForAnalyticsFilter]);

  const handleViewAnalytics = async (seriesId: string, analysisId: string) => {
    setLoadingAnalyticsData(true);
    try {
      const response = await api.getAnalyticsById(seriesId, analysisId);
      setCurrentAnalyticsData(response);
      setViewAnalyticsDialogOpen(true);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      // You might want to show an error notification here
    } finally {
      setLoadingAnalyticsData(false);
    }
  };

  const handleDownloadAnalytics = async (seriesId: string, analysisId: string) => {
    try {
      const response = await api.getAnalyticsById(seriesId, analysisId);
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${seriesId}-${analysisId}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading analytics data:', error);
      // You might want to show an error notification here
    }
  };

  const handleCloseViewAnalyticsDialog = () => {
    setViewAnalyticsDialogOpen(false);
    setCurrentAnalyticsData(null);
  };

  const handleDeleteClick = (seriesId: string, analysisId: string) => {
    setAnalyticsToDelete({ seriesId, analysisId });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (analyticsToDelete) {
      try {
        await api.deleteAnalyticsById(analyticsToDelete.seriesId, analyticsToDelete.analysisId);
        await fetchAnalyticsResults();
      } catch (error) {
        console.error('Error deleting analytics:', error);
      }
    }
    setDeleteDialogOpen(false);
    setAnalyticsToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setAnalyticsToDelete(null);
  };

  const handleCollectionRowClick = (collection: CloudTrailCollection) => {
    setSelectedSeriesIdForAnalyticsFilter(collection.seriesId);
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
            maxHeight={windowHeight - 400}
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
                    {loadingCollections ? <CircularProgress size={24} /> : 'Refresh'}
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
                    onClick={() => setSelectedSeriesIdForAnalyticsFilter(null)}
                  >
                    Clear Analytics Filter
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
                    {loadingCollections ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          <CircularProgress />
                        </TableCell>
                      </TableRow>
                    ) : errorCollections ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ color: 'error.main' }}>
                          {errorCollections}
                        </TableCell>
                      </TableRow>
                    ) : collections.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          No collections found
                        </TableCell>
                      </TableRow>
                    ) : (
                      collections.map((collection) => (
                        <TableRow
                          key={collection.seriesId}
                          onClick={() => handleCollectionRowClick(collection)}
                          onContextMenu={(e) => handleContextMenuOpen(e, collection)}
                          sx={{
                            cursor: 'pointer',
                            backgroundColor: selectedSeriesIdForAnalyticsFilter === collection.seriesId ? 'action.selected' : 'inherit',
                            '&:hover': { backgroundColor: 'action.hover' }
                          }}
                        >
                          <TableCell>{collection.seriesId}</TableCell>
                          <TableCell>{new Date(collection.creationDate).toLocaleString()}</TableCell>
                          <TableCell>{new Date(collection.lastUpdate).toLocaleString()}</TableCell>
                          <TableCell>{collection.eventCount}</TableCell>
                          <TableCell>{new Date(collection.firstEventTime).toLocaleString()}</TableCell>
                          <TableCell>{new Date(collection.lastEventTime).toLocaleString()}</TableCell>
                          <TableCell>{collection.status}</TableCell>
                          <TableCell>{collection.filter}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Resizable>

          {/* Context Menu for Collections Table */}
          <Menu
            open={contextMenuAnchorEl !== null}
            onClose={handleContextMenuClose}
            anchorEl={contextMenuAnchorEl}
            anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          >
            <MenuItem onClick={handleOpenAnalyticsDialog}>Run Analytics</MenuItem>
          </Menu>

          {/* Analytics Dialog */}
          <Dialog open={analyticsDialogOpen} onClose={handleCloseAnalyticsDialog} maxWidth="sm" fullWidth>
            <DialogTitle>Run Analytics for Collection</DialogTitle>
            <DialogContent>
              <TextField
                label="Series ID"
                value={analyticsDialogSeriesId}
                fullWidth
                margin="normal"
                InputProps={{
                  readOnly: true,
                }}
                variant="outlined"
              />
              <TextField
                label="Start Time"
                type="datetime-local"
                value={analyticsDialogStartTime}
                onChange={(e) => setAnalyticsDialogStartTime(e.target.value)}
                fullWidth
                margin="normal"
                InputLabelProps={{
                  shrink: true,
                }}
                variant="outlined"
              />
              <TextField
                label="End Time"
                type="datetime-local"
                value={analyticsDialogEndTime}
                onChange={(e) => setAnalyticsDialogEndTime(e.target.value)}
                fullWidth
                margin="normal"
                InputLabelProps={{
                  shrink: true,
                }}
                variant="outlined"
              />
              {analyticsDialogError && (
                <Typography color="error" sx={{ mt: 2 }}>
                  {analyticsDialogError}
                </Typography>
              )}
            </DialogContent>
            <DialogActions sx={{p: '16px 24px'}}>
              <Button onClick={handleCloseAnalyticsDialog} color="primary" disabled={analyticsSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleRunAnalyticsSubmit} variant="contained" color="primary" disabled={analyticsSubmitting}>
                {analyticsSubmitting ? 'Submitting...' : 'Submit'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Analytics Grid */}
          <Paper sx={{ flex: 1, overflow: 'hidden' }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Analytics Results {selectedSeriesIdForAnalyticsFilter ? `(Filtered for ${selectedSeriesIdForAnalyticsFilter})` : '(All Series)'}</Typography>
              <Box>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<RefreshIcon />}
                  sx={{ mr: 1 }}
                  onClick={() => fetchAnalyticsResults(selectedSeriesIdForAnalyticsFilter)}
                  disabled={loadingAnalytics}
                >
                  {loadingAnalytics ? <CircularProgress size={24} /> : 'Refresh'}
                </Button>
              </Box>
            </Box>
            {errorAnalytics && (
                <Box sx={{ p: 2, pt: 0 }}><Typography color="error">Error: {errorAnalytics}</Typography></Box>
            )}
            <TableContainer sx={{ maxHeight: `calc(100% - ${errorAnalytics ? 90 : 70}px)` }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Series ID</TableCell>
                    <TableCell>Analysis ID</TableCell>
                    <TableCell>Analysis Time</TableCell>
                    <TableCell>Start Time</TableCell>
                    <TableCell>End Time</TableCell>
                    <TableCell>Events Count</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Summary</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingAnalytics ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : errorAnalytics ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ color: 'error.main' }}>
                        {errorAnalytics}
                      </TableCell>
                    </TableRow>
                  ) : filteredAnalytics.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        No analytics results found{selectedSeriesIdForAnalyticsFilter ? ` for series ${selectedSeriesIdForAnalyticsFilter}` : ''}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAnalytics.map((row: AnalyticsResult) => (
                      <TableRow key={`${row.seriesId}-${row.analysisTime}`}>
                        <TableCell>{row.seriesId}</TableCell>
                        <TableCell>{row.analysisId}</TableCell>
                        <TableCell>{new Date(row.analysisTime).toLocaleString()}</TableCell>
                        <TableCell>{new Date(row.results.parameters.startDate).toLocaleString()}</TableCell>
                        <TableCell>{new Date(row.results.parameters.endDate).toLocaleString()}</TableCell>
                        <TableCell>{row.eventsCount}</TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell>
                          {row.results && (
                            <Box>
                              <Typography variant="body2">
                                {`Total Events: ${row.results.summary.total_events_processed}`}
                              </Typography>
                              <Typography variant="body2">
                                {`Security Events: ${row.results.summary.security_insights.total_security_events}`}
                              </Typography>
                              <Typography variant="body2">
                                {`Operational Events: ${row.results.summary.operational_insights.total_operational_events}`}
                              </Typography>
                              <Typography variant="body2">
                                {`Network Events: ${row.results.summary.network_insights.total_network_events}`}
                              </Typography>
                            </Box>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.status === 'Complete' && (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Tooltip title="View Analysis">
                                <IconButton
                                  size="small"
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    handleViewAnalytics(row.seriesId, row.analysisId);
                                  }}
                                  disabled={loadingAnalyticsData}
                                >
                                  <VisibilityIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Download Analysis">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadAnalytics(row.seriesId, row.analysisId);
                                  }}
                                >
                                  <DownloadIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete Analysis">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(row.seriesId, row.analysisId);
                                  }}
                                  color="error"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
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

        {/* View Analytics Dialog */}
        <Dialog
          open={viewAnalyticsDialogOpen}
          onClose={handleCloseViewAnalyticsDialog}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            Analytics Results
            <IconButton
              onClick={handleCloseViewAnalyticsDialog}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {currentAnalyticsData && (
              <>
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">
                    Analysis ID: {currentAnalyticsData.analysisId}
                  </Typography>
                  <Box>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(currentAnalyticsData.seriesId, currentAnalyticsData.analysisId);
                      }}
                      sx={{ mr: 1 }}
                    >
                      Delete
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadAnalytics(currentAnalyticsData.seriesId, currentAnalyticsData.analysisId);
                      }}
                    >
                      Download
                    </Button>
                  </Box>
                </Box>
                <Paper sx={{ p: 2, maxHeight: '60vh', overflow: 'auto' }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {JSON.stringify(currentAnalyticsData, null, 2)}
                  </pre>
                </Paper>
              </>
            )}
            {loadingAnalyticsData && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={handleDeleteCancel}
        >
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete this analytics result? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteCancel}>Cancel</Button>
            <Button onClick={handleDeleteConfirm} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Layout>
    </LocalizationProvider>
  );
};

export default SecurityAudit; 