import React, { useState } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
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
  Paper,
  Chip,
  Alert,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Upload,
  Visibility,
  Delete,
  CheckCircle,
  Pending,
  Cancel,
  PhotoCamera,
  Description,
  LocalPharmacy,
  Add,
  Warning
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';
import axios from 'axios';
import moment from 'moment';

const PrescriptionManagement = () => {
  const [uploadDialog, setUploadDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [doctorName, setDoctorName] = useState('');
  const [doctorRegNumber, setDoctorRegNumber] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [prescriptionDate, setPrescriptionDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');

  const queryClient = useQueryClient();

  // Fetch prescriptions
  const { data: prescriptions, isLoading } = useQuery(
    'user-prescriptions',
    async () => {
      const response = await axios.get('/api/prescriptions/my-prescriptions');
      return response.data.data;
    }
  );

  // Upload prescription mutation
  const uploadPrescriptionMutation = useMutation(
    async (formData) => {
      const response = await axios.post('/api/prescriptions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('user-prescriptions');
        toast.success('Prescription uploaded successfully!');
        setUploadDialog(false);
        resetForm();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to upload prescription');
      }
    }
  );

  // File upload handling
  const onDrop = (acceptedFiles) => {
    setUploadFiles(acceptedFiles);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 5
  });

  const resetForm = () => {
    setUploadFiles([]);
    setDoctorName('');
    setDoctorRegNumber('');
    setPatientName('');
    setPatientAge('');
    setPatientGender('');
    setPrescriptionDate('');
    setValidUntil('');
    setNotes('');
  };

  const handleUpload = () => {
    if (uploadFiles.length === 0) {
      toast.warning('Please select prescription files');
      return;
    }

    if (!doctorName || !doctorRegNumber || !patientName || !patientAge || !patientGender || !prescriptionDate || !validUntil) {
      toast.warning('Please fill in all required fields');
      return;
    }

    const formData = new FormData();
    uploadFiles.forEach((file) => {
      formData.append('prescription', file);
    });
    formData.append('doctorName', doctorName);
    formData.append('doctorRegistrationNumber', doctorRegNumber);
    formData.append('patientName', patientName);
    formData.append('patientAge', patientAge);
    formData.append('patientGender', patientGender);
    formData.append('prescriptionDate', prescriptionDate);
    formData.append('validUntil', validUntil);
    formData.append('notes', notes);

    uploadPrescriptionMutation.mutate(formData);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'error';
      case 'under_review':
        return 'warning';
      case 'pending':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle />;
      case 'rejected':
        return <Cancel />;
      case 'under_review':
        return <Pending />;
      case 'pending':
        return <Pending />;
      default:
        return <Pending />;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          My Prescriptions
        </Typography>
        <Button
          variant="contained"
          startIcon={<Upload />}
          onClick={() => setUploadDialog(true)}
        >
          Upload Prescription
        </Button>
      </Box>

      {/* Instructions */}
      <Alert severity="info" sx={{ mb: 3 }}>
        Upload your doctor's prescription to order prescription medicines. Our pharmacist will review and approve them.
      </Alert>

      {/* Prescriptions List */}
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Your Prescriptions
          </Typography>
          
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : prescriptions && prescriptions.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Prescription #</TableCell>
                    <TableCell>Doctor</TableCell>
                    <TableCell>Patient</TableCell>
                    <TableCell>Upload Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {prescriptions.map((prescription) => (
                    <TableRow key={prescription._id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          #{prescription.prescriptionNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>{prescription.doctorName}</TableCell>
                      <TableCell>{prescription.patientName}</TableCell>
                      <TableCell>
                        {moment(prescription.createdAt).format('DD/MM/YYYY')}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={prescription.status.replace('_', ' ').toUpperCase()}
                          color={getStatusColor(prescription.status)}
                          icon={getStatusIcon(prescription.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedPrescription(prescription);
                            setViewDialog(true);
                          }}
                        >
                          <Visibility />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Description sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No prescriptions uploaded yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Upload your first prescription to get started
              </Typography>
              <Button
                variant="contained"
                startIcon={<Upload />}
                onClick={() => setUploadDialog(true)}
              >
                Upload Prescription
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialog} onClose={() => setUploadDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Upload Prescription</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Doctor Information */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                Doctor Information
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Doctor Name"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Doctor Registration Number"
                value={doctorRegNumber}
                onChange={(e) => setDoctorRegNumber(e.target.value)}
                required
              />
            </Grid>

            {/* Patient Information */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 2 }}>
                Patient Information
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Patient Name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Patient Age"
                type="number"
                value={patientAge}
                onChange={(e) => setPatientAge(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth required>
                <InputLabel>Patient Gender</InputLabel>
                <Select
                  value={patientGender}
                  label="Patient Gender"
                  onChange={(e) => setPatientGender(e.target.value)}
                >
                  <MenuItem value="male">Male</MenuItem>
                  <MenuItem value="female">Female</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Prescription Dates */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 2 }}>
                Prescription Dates
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Prescription Date"
                type="date"
                value={prescriptionDate}
                onChange={(e) => setPrescriptionDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Valid Until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Additional Notes (Optional)"
                multiline
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions or notes..."
              />
            </Grid>

            {/* File Upload */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Upload Prescription Files
              </Typography>
              <Box
                {...getRootProps()}
                sx={{
                  border: '2px dashed #ccc',
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.main' }
                }}
              >
                <input {...getInputProps()} />
                <PhotoCamera sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography>
                  {isDragActive
                    ? "Drop the files here..."
                    : "Drag 'n' drop prescription files here, or click to select"
                  }
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Supports: JPG, PNG, PDF (Max 5 files)
                </Typography>
              </Box>

              {uploadFiles.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Selected Files:
                  </Typography>
                  <List>
                    {uploadFiles.map((file, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Description />
                        </ListItemIcon>
                        <ListItemText
                          primary={file.name}
                          secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
                        />
                        <IconButton
                          onClick={() => {
                            const newFiles = [...uploadFiles];
                            newFiles.splice(index, 1);
                            setUploadFiles(newFiles);
                          }}
                        >
                          <Delete />
                        </IconButton>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Grid>

            {/* Requirements */}
            <Grid item xs={12}>
              <Alert severity="warning" icon={<Warning />}>
                <Typography variant="subtitle2" gutterBottom>
                  Prescription Requirements:
                </Typography>
                <List dense>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText primary="• Valid doctor's prescription with signature and stamp" />
                  </ListItem>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText primary="• Clear, readable image or PDF" />
                  </ListItem>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText primary="• Patient name and details visible" />
                  </ListItem>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText primary="• Prescription date within validity period" />
                  </ListItem>
                </List>
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            variant="contained"
            disabled={uploadPrescriptionMutation.isLoading}
          >
            {uploadPrescriptionMutation.isLoading ? 'Uploading...' : 'Upload Prescription'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Prescription Dialog */}
      <Dialog 
        open={viewDialog} 
        onClose={() => setViewDialog(false)} 
        maxWidth="md" 
        fullWidth
      >
        {selectedPrescription && (
          <>
            <DialogTitle>
              Prescription #{selectedPrescription.prescriptionNumber}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">Doctor:</Typography>
                  <Typography variant="body2" gutterBottom>
                    {selectedPrescription.doctorName}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">Patient:</Typography>
                  <Typography variant="body2" gutterBottom>
                    {selectedPrescription.patientName}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">Upload Date:</Typography>
                  <Typography variant="body2" gutterBottom>
                    {moment(selectedPrescription.createdAt).format('DD/MM/YYYY HH:mm')}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">Status:</Typography>
                  <Chip
                    label={selectedPrescription.status.replace('_', ' ').toUpperCase()}
                    color={getStatusColor(selectedPrescription.status)}
                    icon={getStatusIcon(selectedPrescription.status)}
                    size="small"
                  />
                </Grid>
                
                {selectedPrescription.reviewNotes && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2">Review Notes:</Typography>
                    <Typography variant="body2" gutterBottom>
                      {selectedPrescription.reviewNotes}
                    </Typography>
                  </Grid>
                )}

                {selectedPrescription.notes && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2">Your Notes:</Typography>
                    <Typography variant="body2" gutterBottom>
                      {selectedPrescription.notes}
                    </Typography>
                  </Grid>
                )}

                {/* Prescribed Medicines */}
                {selectedPrescription.prescribedMedicines && 
                 selectedPrescription.prescribedMedicines.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Prescribed Medicines:
                    </Typography>
                    <List>
                      {selectedPrescription.prescribedMedicines.map((medicine, index) => (
                        <ListItem key={index} divider>
                          <ListItemIcon>
                            <LocalPharmacy />
                          </ListItemIcon>
                          <ListItemText
                            primary={medicine.name}
                            secondary={`${medicine.dosage} - ${medicine.instructions}`}
                          />
                          <Chip
                            label={medicine.available ? 'Available' : 'Not Available'}
                            color={medicine.available ? 'success' : 'error'}
                            size="small"
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                )}

                {/* Prescription Images */}
                {selectedPrescription.documents && 
                 selectedPrescription.documents.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Prescription Documents:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {selectedPrescription.documents.map((doc, index) => (
                        <img
                          key={index}
                          src={doc}
                          alt={`Prescription ${index + 1}`}
                          style={{
                            width: 150,
                            height: 200,
                            objectFit: 'cover',
                            borderRadius: 8,
                            border: '1px solid #ddd'
                          }}
                          onClick={() => window.open(doc, '_blank')}
                        />
                      ))}
                    </Box>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setViewDialog(false)}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default PrescriptionManagement; 