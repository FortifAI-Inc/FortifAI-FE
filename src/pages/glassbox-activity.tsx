import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Divider,
  IconButton,
  CircularProgress,
  Alert,
  Badge,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
// Custom Timeline components using standard MUI
interface TimelineItemProps {
  children: React.ReactNode;
}

interface TimelineContentProps {
  children: React.ReactNode;
  sx?: any;
}

const CustomTimeline: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box>{children}</Box>
);

const CustomTimelineItem: React.FC<TimelineItemProps> = ({ children }) => (
  <Box sx={{ display: 'flex', mb: 2 }}>{children}</Box>
);

const CustomTimelineContent: React.FC<TimelineContentProps> = ({ children, sx }) => (
  <Box sx={{ flex: 1, ...sx }}>{children}</Box>
);

const CustomTimelineOppositeContent: React.FC<TimelineContentProps> = ({ children, sx }) => (
  <Box sx={{ width: 120, textAlign: 'right', mr: 2, ...sx }}>{children}</Box>
);

const CustomTimelineSeparator: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mr: 2 }}>
    {children}
  </Box>
);

const CustomTimelineDot: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <Box
    sx={{
      width: 40,
      height: 40,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: `${color}.main`,
      color: 'white',
      mb: 1,
    }}
  >
    {children}
  </Box>
);

const CustomTimelineConnector: React.FC = () => (
  <Box
    sx={{
      width: 2,
      height: 40,
      bgcolor: 'grey.300',
      mb: 1,
    }}
  />
);
import {
  Computer as ComputerIcon,
  Psychology as PsychologyIcon,
  Http as HttpIcon,
  Refresh as RefreshIcon,
  NavigateBefore as NavigateBeforeIcon,
  NavigateNext as NavigateNextIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { api } from '../services/api';

interface Agent {
  agent_id: string;
  last_seen: string;
  event_count: number;
  agent_type?: string;
  location?: string;
}

interface Event {
  event_id: string;
  agent_id: string;
  timestamp: string;
  event_type: string;
  event_category: string;
  source: string;
  event_data: any;
  session_id?: string;
  correlation_id?: string;
}

interface EventStats {
  total_events: number;
  event_types: { [key: string]: number };
  agents_count: number;
  time_range: {
    start: string;
    end: string;
  };
}

const GlassboxActivityPage: React.FC = () => {
  // State management
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventStats, setEventStats] = useState<EventStats | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter and pagination state
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [startTime, setStartTime] = useState<Date>(new Date(Date.now() - 24 * 60 * 60 * 1000)); // 24 hours ago
  const [endTime, setEndTime] = useState<Date>(new Date());
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  
  // Dialog state
  const [eventDetailOpen, setEventDetailOpen] = useState(false);

  // Load agents on component mount
  useEffect(() => {
    loadAgents();
  }, []);

  // Load events when agent or filters change
  useEffect(() => {
    if (selectedAgent) {
      loadEvents();
      loadEventStats();
    }
  }, [selectedAgent, eventTypeFilter, startTime, endTime, limit, offset]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try the agents endpoint first
      try {
        const agentsData = await api.getAgents();
        setAgents(agentsData);
        return;
      } catch (agentError) {
        console.warn('Agents endpoint failed, falling back to extracting from events:', agentError);
      }
      
      // Fallback: Extract agents from recent events
      const eventsData = await api.getEvents({
        limit: 1000, // Get a good sample of recent events
        offset: 0
      });
      
      if (eventsData.events) {
        const agentMap = new Map();
        eventsData.events.forEach((event: Event) => {
          const agentId = event.agent_id;
          if (!agentMap.has(agentId)) {
            agentMap.set(agentId, {
              agent_id: agentId,
              last_seen: event.timestamp,
              event_count: 1,
              agent_type: 'glassbox', // Default type
              location: event.event_data?.client_ip || 'unknown'
            });
          } else {
            const agent = agentMap.get(agentId);
            agent.event_count++;
            // Update last_seen if this event is more recent
            if (new Date(event.timestamp) > new Date(agent.last_seen)) {
              agent.last_seen = event.timestamp;
            }
          }
        });
        
        const agentsArray = Array.from(agentMap.values()).sort((a, b) => 
          new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
        );
        
        setAgents(agentsArray);
      }
    } catch (err) {
      setError('Failed to load agents');
      console.error('Error loading agents:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    if (!selectedAgent) return;
    
    try {
      setLoading(true);
      setError(null);
      const eventsData = await api.getEvents({
        agent_id: selectedAgent.agent_id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        event_type: eventTypeFilter || undefined,
        limit,
        offset,
      });
      setEvents(eventsData.events || []);
    } catch (err) {
      setError('Failed to load events');
      console.error('Error loading events:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEventStats = async () => {
    if (!selectedAgent) return;
    
    try {
      // Try the stats endpoint first
      try {
        const statsData = await api.getEventStats(
          selectedAgent.agent_id,
          `${startTime.toISOString()},${endTime.toISOString()}`
        );
        setEventStats(statsData);
        return;
      } catch (statsError) {
        console.warn('Stats endpoint failed, calculating from events:', statsError);
      }
      
      // Fallback: Calculate stats from events
      const eventsData = await api.getEvents({
        agent_id: selectedAgent.agent_id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        limit: 1000
      });
      
      if (eventsData.events) {
        const eventTypes: { [key: string]: number } = {};
        eventsData.events.forEach((event: Event) => {
          eventTypes[event.event_type] = (eventTypes[event.event_type] || 0) + 1;
        });
        
        const stats = {
          total_events: eventsData.events.length,
          event_types: eventTypes,
          agents_count: 1,
          time_range: {
            start: startTime.toISOString(),
            end: endTime.toISOString()
          }
        };
        
        setEventStats(stats);
      }
    } catch (err) {
      console.error('Error loading event stats:', err);
    }
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setEventDetailOpen(true);
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'llm_request':
      case 'llm_response':
        return <PsychologyIcon />;
      case 'network_connection':
        return <HttpIcon />;
      default:
        return <ComputerIcon />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'llm_request':
        return 'primary';
      case 'llm_response':
        return 'secondary';
      case 'network_connection':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatEventData = (eventData: any) => {
    return Object.entries(eventData).map(([key, value]) => (
      <Box key={key} sx={{ mb: 1 }}>
        <Typography variant="body2" component="span" sx={{ fontWeight: 'bold' }}>
          {key}:
        </Typography>
        <Typography variant="body2" component="span" sx={{ ml: 1 }}>
          {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
        </Typography>
      </Box>
    ));
  };

  const handleTimeRangeChange = (hours: number) => {
    const now = new Date();
    setEndTime(now);
    setStartTime(new Date(now.getTime() - hours * 60 * 60 * 1000));
    setOffset(0); // Reset pagination
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
          🔍 Glassbox Activity Log
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Agents Panel */}
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <PersonIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">Agents</Typography>
                  <IconButton onClick={loadAgents} size="small" sx={{ ml: 'auto' }}>
                    <RefreshIcon />
                  </IconButton>
                </Box>
                {loading && agents.length === 0 ? (
                  <CircularProgress size={24} />
                ) : (
                  <List dense>
                    {agents.map((agent) => (
                      <ListItem
                        key={agent.agent_id}
                        button
                        selected={selectedAgent?.agent_id === agent.agent_id}
                        onClick={() => setSelectedAgent(agent)}
                        sx={{
                          borderRadius: 1,
                          mb: 1,
                          '&.Mui-selected': {
                            backgroundColor: 'primary.light',
                            color: 'primary.contrastText',
                          },
                        }}
                      >
                        <ListItemIcon>
                          <Badge badgeContent={agent.event_count} color="primary">
                            <ComputerIcon />
                          </Badge>
                        </ListItemIcon>
                        <ListItemText
                          primary={agent.agent_id}
                          secondary={`Last seen: ${new Date(agent.last_seen).toLocaleString()}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Main Content */}
          <Grid item xs={12} md={9}>
            {selectedAgent ? (
              <>
                {/* Controls Panel */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Activity for {selectedAgent.agent_id}
                    </Typography>
                    
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Event Type</InputLabel>
                          <Select
                            value={eventTypeFilter}
                            onChange={(e) => setEventTypeFilter(e.target.value)}
                            label="Event Type"
                          >
                            <MenuItem value="">All Types</MenuItem>
                            <MenuItem value="llm_request">LLM Requests</MenuItem>
                            <MenuItem value="llm_response">LLM Responses</MenuItem>
                            <MenuItem value="network_connection">Network</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12} sm={6} md={3}>
                        <DateTimePicker
                          label="Start Time"
                          value={startTime}
                          onChange={(newValue) => newValue && setStartTime(newValue)}
                          slotProps={{ textField: { size: 'small', fullWidth: true } }}
                        />
                      </Grid>
                      
                      <Grid item xs={12} sm={6} md={3}>
                        <DateTimePicker
                          label="End Time"
                          value={endTime}
                          onChange={(newValue) => newValue && setEndTime(newValue)}
                          slotProps={{ textField: { size: 'small', fullWidth: true } }}
                        />
                      </Grid>
                      
                      <Grid item xs={12} sm={6} md={3}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button size="small" onClick={() => handleTimeRangeChange(1)}>1h</Button>
                          <Button size="small" onClick={() => handleTimeRangeChange(6)}>6h</Button>
                          <Button size="small" onClick={() => handleTimeRangeChange(24)}>24h</Button>
                        </Box>
                      </Grid>
                    </Grid>

                    {/* Stats */}
                    {eventStats && (
                      <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <Chip label={`Total: ${eventStats.total_events}`} color="primary" />
                        {Object.entries(eventStats.event_types).map(([type, count]) => (
                          <Chip key={type} label={`${type}: ${count}`} variant="outlined" />
                        ))}
                      </Box>
                    )}
                  </CardContent>
                </Card>

                {/* Events Timeline */}
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Event Timeline
                    </Typography>
                    
                    {loading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                      </Box>
                    ) : events.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', p: 4 }}>
                        No events found for the selected time range and filters.
                      </Typography>
                    ) : (
                      <CustomTimeline>
                        {events.map((event, index) => (
                          <CustomTimelineItem key={event.event_id}>
                            <CustomTimelineOppositeContent sx={{ m: 'auto 0' }}>
                              <Typography variant="body2" color="text.secondary">
                                {new Date(event.timestamp).toLocaleTimeString()}
                              </Typography>
                            </CustomTimelineOppositeContent>
                            <CustomTimelineSeparator>
                              <CustomTimelineDot color={getEventColor(event.event_type)}>
                                {getEventIcon(event.event_type)}
                              </CustomTimelineDot>
                              {index < events.length - 1 && <CustomTimelineConnector />}
                            </CustomTimelineSeparator>
                            <CustomTimelineContent sx={{ py: '12px', px: 2 }}>
                              <Paper
                                elevation={1}
                                sx={{ p: 2, cursor: 'pointer', '&:hover': { elevation: 3 } }}
                                onClick={() => handleEventClick(event)}
                              >
                                <Typography variant="h6" component="span">
                                  {event.event_type}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {event.event_data?.method} {event.event_data?.host || event.event_data?.url}
                                </Typography>
                                <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                  <Chip size="small" label={event.event_category} />
                                  <Chip size="small" label={event.source} variant="outlined" />
                                </Box>
                              </Paper>
                            </CustomTimelineContent>
                          </CustomTimelineItem>
                        ))}
                      </CustomTimeline>
                    )}

                    {/* Pagination */}
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 2 }}>
                      <Button
                        startIcon={<NavigateBeforeIcon />}
                        disabled={offset === 0}
                        onClick={() => setOffset(Math.max(0, offset - limit))}
                      >
                        Previous
                      </Button>
                      <Button
                        endIcon={<NavigateNextIcon />}
                        disabled={events.length < limit}
                        onClick={() => setOffset(offset + limit)}
                      >
                        Next
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 8 }}>
                  <ComputerIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    Select an agent to view activity
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Choose an agent from the list to see their event timeline and activity details.
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>

        {/* Event Detail Dialog */}
        <Dialog
          open={eventDetailOpen}
          onClose={() => setEventDetailOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {selectedEvent && getEventIcon(selectedEvent.event_type)}
              <Typography variant="h6" sx={{ ml: 1 }}>
                Event Details
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            {selectedEvent && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" gutterBottom>Event ID</Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>{selectedEvent.event_id}</Typography>
                  
                  <Typography variant="subtitle2" gutterBottom>Timestamp</Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {new Date(selectedEvent.timestamp).toLocaleString()}
                  </Typography>
                  
                  <Typography variant="subtitle2" gutterBottom>Event Type</Typography>
                  <Chip label={selectedEvent.event_type} color={getEventColor(selectedEvent.event_type) as any} sx={{ mb: 2 }} />
                  
                  <Typography variant="subtitle2" gutterBottom>Category</Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>{selectedEvent.event_category}</Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" gutterBottom>Agent ID</Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>{selectedEvent.agent_id}</Typography>
                  
                  <Typography variant="subtitle2" gutterBottom>Source</Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>{selectedEvent.source}</Typography>
                  
                  {selectedEvent.session_id && (
                    <>
                      <Typography variant="subtitle2" gutterBottom>Session ID</Typography>
                      <Typography variant="body2" sx={{ mb: 2 }}>{selectedEvent.session_id}</Typography>
                    </>
                  )}
                  
                  {selectedEvent.correlation_id && (
                    <>
                      <Typography variant="subtitle2" gutterBottom>Correlation ID</Typography>
                      <Typography variant="body2" sx={{ mb: 2 }}>{selectedEvent.correlation_id}</Typography>
                    </>
                  )}
                </Grid>
                
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>Event Data</Typography>
                  <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                    {formatEventData(selectedEvent.event_data)}
                  </Paper>
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEventDetailOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </LocalizationProvider>
  );
};

export default GlassboxActivityPage; 