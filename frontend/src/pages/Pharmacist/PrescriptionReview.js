import React, { useState } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Avatar,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip
} from '@mui/material';
import {
  Visibility,
  CheckCircle,
  Cancel,
  Schedule,
  Person,
  Download,
  Refresh,
  FilterList,
  Assignment
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import api from '../../api/config';

const PrescriptionReview = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [viewDialog, setViewDialog] = useState(false);
  const [actionDialog, setActionDialog] = useState(false);
  const [actionType, setActionType] = useState('');
  const [actionNotes, setActionNotes] = useState('');

  const queryClient = useQueryClient();

  // Fetch pending prescriptions
  const { data: prescriptionsData, isLoading, refetch } = useQuery(
    ['prescriptions', 'pending-reviews', page, rowsPerPage, statusFilter],
    async () => {
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        ...(statusFilter !== 'all' && { status: statusFilter })
      });

      const response = await api.get(`/api/prescriptions/pending-reviews?${params}`);
      return response.data;
    },
    {
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to fetch prescriptions');
      }
    }
  );

  // Fetch prescription stats
  const { data: stats } = useQuery(
    ['prescriptions', 'stats'],
    async () => {
      const response = await api.get('/api/prescriptions/meta/stats');
      return response.data.data;
    }
  );

  // Approve prescription mutation
  const approveMutation = useMutation(
    async ({ id, notes, medicines }) => {
      const response = await api.patch(`/api/prescriptions/${id}/approve`, 
        { 
          notes,
          medicines: medicines || [] // Default to empty array if no medicines provided
        }
      );
      return response.data;
    },
    {
      onSuccess: () => {
        toast.success('Prescription approved successfully!');
        queryClient.invalidateQueries(['prescriptions']);
        setActionDialog(false);
        setSelectedPrescription(null);
        setActionNotes('');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to approve prescription');
      }
    }
  );

  // Reject prescription mutation
  const rejectMutation = useMutation(
    async ({ id, reason }) => {
      const response = await api.patch(`/api/prescriptions/${id}/reject`, 
        { reason }
      );
      return response.data;
    },
    {
      onSuccess: () => {
        toast.success('Prescription rejected');
        queryClient.invalidateQueries(['prescriptions']);
        setActionDialog(false);
        setSelectedPrescription(null);
        setActionNotes('');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to reject prescription');
      }
    }
  );

  const prescriptions = prescriptionsData?.data || [];
  const totalPrescriptions = prescriptionsData?.total || 0;

  const handleViewPrescription = (prescription) => {
    setSelectedPrescription(prescription);
    setViewDialog(true);
  };

  const handleAction = (prescription, type) => {
    setSelectedPrescription(prescription);
    setActionType(type);
    setActionDialog(true);
  };

  const handleSubmitAction = () => {
    if (actionType === 'approve') {
      // Create a default medicines array for approval
      // In a real system, this would come from the prescription or be entered by the pharmacist
      const defaultMedicines = [
        {
          name: 'Paracetamol',
          dosage: '500mg',
          frequency: 'Twice daily',
          duration: '5 days',
          quantity: 10
        }
      ];

      approveMutation.mutate({
        id: selectedPrescription._id,
        notes: actionNotes,
        medicines: defaultMedicines
      });
    } else if (actionType === 'reject') {
      rejectMutation.mutate({
        id: selectedPrescription._id,
        reason: actionNotes
      });
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'warning',
      approved: 'success',
      rejected: 'error',
      under_review: 'info'
    };
    return colors[status] || 'default';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Prescription Review
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Review and approve customer prescriptions
        </Typography>
      </Box>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={2}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'warning.main' }}>
                    <Schedule />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" color="warning.main">
                      {stats.pending || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pending Review
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={2}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'success.main' }}>
                    <CheckCircle />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" color="success.main">
                      {stats.approved || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Approved Today
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={2}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'info.main' }}>
                    <Assignment />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" color="info.main">
                      {stats.underReview || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Under Review
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={2}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'error.main' }}>
                    <Cancel />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" color="error.main">
                      {stats.rejected || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Rejected Today
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Status Filter</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status Filter"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="pending">Pending Review</MenuItem>
                  <MenuItem value="under_review">Under Review</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                  <MenuItem value="all">All Prescriptions</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => refetch()}
                fullWidth
              >
                Refresh
              </Button>
            </Grid>

            <Grid item xs={12} md={4}>
              <Button
                variant="contained"
                startIcon={<FilterList />}
                onClick={() => toast.info('Advanced filters coming soon!')}
                fullWidth
              >
                Advanced Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Prescriptions Table */}
      <Card elevation={2}>
        <CardContent>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <Typography>Loading prescriptions...</Typography>
            </Box>
          ) : prescriptions.length === 0 ? (
            <Alert severity="info">
              <Typography variant="h6" gutterBottom>
                No prescriptions found
              </Typography>
              <Typography>
                No prescriptions matching your criteria. Try changing the filter or refresh the page.
              </Typography>
            </Alert>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Prescription</TableCell>
                      <TableCell>Patient</TableCell>
                      <TableCell>Doctor</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {prescriptions.map((prescription) => (
                      <TableRow key={prescription._id} hover>
                        <TableCell>
                          <Box>
                            <Typography variant="subtitle2" fontWeight="bold">
                              #{prescription.prescriptionNumber}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {prescription.documents?.length || 0} document(s)
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar>
                              <Person />
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle2">
                                {prescription.patientInfo?.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Age: {prescription.patientInfo?.age}, {prescription.patientInfo?.gender}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="subtitle2">
                              {prescription.doctorInfo?.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {prescription.doctorInfo?.registrationNumber}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatDate(prescription.prescriptionDate)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Valid until: {formatDate(prescription.validUntil)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={prescription.status.toUpperCase()} 
                            color={getStatusColor(prescription.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                onClick={() => handleViewPrescription(prescription)}
                              >
                                <Visibility />
                              </IconButton>
                            </Tooltip>
                            
                            {prescription.status === 'pending' && (
                              <>
                                <Tooltip title="Approve">
                                  <IconButton
                                    size="small"
                                    color="success"
                                    onClick={() => handleAction(prescription, 'approve')}
                                  >
                                    <CheckCircle />
                                  </IconButton>
                                </Tooltip>
                                
                                <Tooltip title="Reject">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleAction(prescription, 'reject')}
                                  >
                                    <Cancel />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={totalPrescriptions}
                page={page}
                onPageChange={(event, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(event) => {
                  setRowsPerPage(parseInt(event.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[5, 10, 25, 50]}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* View Prescription Dialog */}
      <Dialog open={viewDialog} onClose={() => setViewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Prescription Details - #{selectedPrescription?.prescriptionNumber}
        </DialogTitle>
        <DialogContent>
          {selectedPrescription && (
            <Grid container spacing={3} sx={{ mt: 1 }}>
              {/* Patient Info */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Patient Information
                </Typography>
                <Box sx={{ pl: 2 }}>
                  <Typography><strong>Name:</strong> {selectedPrescription.patientInfo?.name}</Typography>
                  <Typography><strong>Age:</strong> {selectedPrescription.patientInfo?.age}</Typography>
                  <Typography><strong>Gender:</strong> {selectedPrescription.patientInfo?.gender}</Typography>
                </Box>
              </Grid>

              {/* Doctor Info */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Doctor Information
                </Typography>
                <Box sx={{ pl: 2 }}>
                  <Typography><strong>Name:</strong> {selectedPrescription.doctorInfo?.name}</Typography>
                  <Typography><strong>Registration:</strong> {selectedPrescription.doctorInfo?.registrationNumber}</Typography>
                </Box>
              </Grid>

              {/* Prescription Details */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Prescription Details
                </Typography>
                <Box sx={{ pl: 2 }}>
                  <Typography><strong>Date:</strong> {formatDate(selectedPrescription.prescriptionDate)}</Typography>
                  <Typography><strong>Valid Until:</strong> {formatDate(selectedPrescription.validUntil)}</Typography>
                  <Typography><strong>Status:</strong> 
                    <Chip 
                      label={selectedPrescription.status.toUpperCase()} 
                      color={getStatusColor(selectedPrescription.status)}
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  </Typography>
                  {selectedPrescription.notes && (
                    <Typography><strong>Notes:</strong> {selectedPrescription.notes}</Typography>
                  )}
                </Box>
              </Grid>

              {/* Documents */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Prescription Documents ({selectedPrescription.documents?.length || 0})
                </Typography>
                {selectedPrescription.documents?.map((doc, index) => (
                  <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="subtitle2">{doc.originalName}</Typography>
                      <Button
                        size="small"
                        startIcon={<Download />}
                        onClick={() => window.open(doc.url, '_blank')}
                      >
                        View/Download
                      </Button>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Size: {(doc.size / 1024 / 1024).toFixed(2)} MB
                    </Typography>
                  </Box>
                ))}
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialog(false)}>Close</Button>
          {selectedPrescription?.status === 'pending' && (
            <>
              <Button
                variant="contained"
                color="success"
                onClick={() => {
                  setViewDialog(false);
                  handleAction(selectedPrescription, 'approve');
                }}
              >
                Approve
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={() => {
                  setViewDialog(false);
                  handleAction(selectedPrescription, 'reject');
                }}
              >
                Reject
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionDialog} onClose={() => setActionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {actionType === 'approve' ? 'Approve Prescription' : 'Reject Prescription'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label={actionType === 'approve' ? 'Approval Notes (Optional)' : 'Rejection Reason (Required)'}
            value={actionNotes}
            onChange={(e) => setActionNotes(e.target.value)}
            placeholder={
              actionType === 'approve' 
                ? 'Add any notes about the approval...'
                : 'Please provide a reason for rejection...'
            }
            sx={{ mt: 2 }}
            required={actionType === 'reject'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color={actionType === 'approve' ? 'success' : 'error'}
            onClick={handleSubmitAction}
            disabled={actionType === 'reject' && !actionNotes.trim()}
          >
            {actionType === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PrescriptionReview; 