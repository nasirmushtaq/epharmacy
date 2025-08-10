import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  Link,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuth } from '../../contexts/AuthContext';

// Unified validation schema that handles all roles
const unifiedValidationSchema = yup.object().shape({
  firstName: yup.string().required('First name is required'),
  lastName: yup.string().required('Last name is required'),
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
  confirmPassword: yup.string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Confirm password is required'),
  phone: yup.string().required('Phone number is required'),
  role: yup.string().required('Role is required'),
  address: yup.string().required('Address is required'),
  city: yup.string().required('City is required'),
  state: yup.string().required('State is required'),
  pincode: yup.string().required('Pincode is required'),
  
  // Conditional fields for pharmacist
  licenseNumber: yup.string().when('role', {
    is: 'pharmacist',
    then: () => yup.string().required('License number is required'),
    otherwise: () => yup.string().nullable().optional()
  }),
  licenseExpiry: yup.string().when('role', {
    is: 'pharmacist',
    then: () => yup.string().required('License expiry date is required'),
    otherwise: () => yup.string().nullable().optional()
  }),
  pharmacyName: yup.string().when('role', {
    is: 'pharmacist',
    then: () => yup.string().required('Pharmacy name is required'),
    otherwise: () => yup.string().nullable().optional()
  }),
  qualifications: yup.string().when('role', {
    is: 'pharmacist',
    then: () => yup.string().required('Qualifications are required'),
    otherwise: () => yup.string().nullable().optional()
  }),
  experience: yup.mixed().when('role', {
    is: 'pharmacist',
    then: () => yup.number().min(0, 'Experience must be positive').required('Experience is required'),
    otherwise: () => yup.mixed().nullable().optional()
  }),
  
  // Conditional fields for delivery agent
  vehicleType: yup.string().when('role', {
    is: 'delivery_agent',
    then: () => yup.string().required('Vehicle type is required'),
    otherwise: () => yup.string().nullable().optional()
  }),
  vehicleNumber: yup.string().when('role', {
    is: 'delivery_agent',
    then: () => yup.string().required('Vehicle number is required'),
    otherwise: () => yup.string().nullable().optional()
  }),
  drivingLicense: yup.string().when('role', {
    is: 'delivery_agent',
    then: () => yup.string().required('Driving license is required'),
    otherwise: () => yup.string().nullable().optional()
  })
});

const RegisterPage = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedRole, setSelectedRole] = useState('customer');
  const navigate = useNavigate();
  const { register, loading, error } = useAuth();

  const { control, handleSubmit, formState: { errors }, watch } = useForm({
    resolver: yupResolver(unifiedValidationSchema),
    defaultValues: {
      role: 'customer',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      // Pharmacist fields
      licenseNumber: null,
      licenseExpiry: null,
      pharmacyName: null,
      qualifications: null,
      experience: null,
      // Delivery agent fields
      vehicleType: null,
      vehicleNumber: null,
      drivingLicense: null
    },
    mode: 'onChange'
  });

  const watchedRole = watch('role');

  React.useEffect(() => {
    setSelectedRole(watchedRole);
  }, [watchedRole]);

  const steps = ['Basic Information', 'Contact Details', 'Role Specific Information'];

  const onSubmit = async (data) => {
    console.log('Form submission started:', data);
    try {
      // Transform data to match backend expected format
      const transformedData = {
        ...data,
        address: {
          street: data.address,
          city: data.city,
          state: data.state,
          zipCode: data.pincode
        }
      };
      
      // Remove the flat address fields
      delete transformedData.city;
      delete transformedData.state;
      delete transformedData.pincode;
      
      // Remove empty optional fields based on role
      if (data.role !== 'pharmacist') {
        delete transformedData.licenseNumber;
        delete transformedData.licenseExpiry;
        delete transformedData.pharmacyName;
        delete transformedData.qualifications;
        delete transformedData.experience;
      } else {
        // Convert experience to number for pharmacists
        if (transformedData.experience) {
          transformedData.experience = Number(transformedData.experience);
        }
      }
      
      if (data.role !== 'delivery_agent') {
        delete transformedData.vehicleType;
        delete transformedData.vehicleNumber;
        delete transformedData.drivingLicense;
      }
      
      console.log('Calling register API with:', transformedData);
      
      const result = await register(transformedData);
      console.log('Register API result:', result);
      
      if (result.success) {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Registration failed:', err);
    }
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.role}>
                    <InputLabel>Role</InputLabel>
                    <Select {...field} label="Role">
                      <MenuItem value="customer">Customer</MenuItem>
                      <MenuItem value="pharmacist">Pharmacist</MenuItem>
                      <MenuItem value="delivery_agent">Delivery Agent</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <Controller
                name="firstName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="First Name"
                    error={!!errors.firstName}
                    helperText={errors.firstName?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <Controller
                name="lastName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Last Name"
                    error={!!errors.lastName}
                    helperText={errors.lastName?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Email"
                    type="email"
                    error={!!errors.email}
                    helperText={errors.email?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <Controller
                name="password"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Password"
                    type="password"
                    error={!!errors.password}
                    helperText={errors.password?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <Controller
                name="confirmPassword"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Confirm Password"
                    type="password"
                    error={!!errors.confirmPassword}
                    helperText={errors.confirmPassword?.message}
                  />
                )}
              />
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Phone Number"
                    error={!!errors.phone}
                    helperText={errors.phone?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="address"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Address"
                    multiline
                    rows={3}
                    error={!!errors.address}
                    helperText={errors.address?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={4}>
              <Controller
                name="city"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="City"
                    error={!!errors.city}
                    helperText={errors.city?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={4}>
              <Controller
                name="state"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="State"
                    error={!!errors.state}
                    helperText={errors.state?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={4}>
              <Controller
                name="pincode"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Pincode"
                    error={!!errors.pincode}
                    helperText={errors.pincode?.message}
                  />
                )}
              />
            </Grid>
          </Grid>
        );

      case 2:
        return (
          <Grid container spacing={2}>
            {selectedRole === 'pharmacist' && (
              <>
                <Grid item xs={12}>
                  <Controller
                    name="licenseNumber"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Pharmacy License Number"
                        error={!!errors.licenseNumber}
                        helperText={errors.licenseNumber?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Controller
                    name="licenseExpiry"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="License Expiry Date"
                        type="date"
                        InputLabelProps={{
                          shrink: true,
                        }}
                        error={!!errors.licenseExpiry}
                        helperText={errors.licenseExpiry?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Controller
                    name="pharmacyName"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Pharmacy Name"
                        error={!!errors.pharmacyName}
                        helperText={errors.pharmacyName?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Controller
                    name="qualifications"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Qualifications"
                        multiline
                        rows={3}
                        error={!!errors.qualifications}
                        helperText={errors.qualifications?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Controller
                    name="experience"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Years of Experience"
                        type="number"
                        error={!!errors.experience}
                        helperText={errors.experience?.message}
                      />
                    )}
                  />
                </Grid>
              </>
            )}
            {selectedRole === 'delivery_agent' && (
              <>
                <Grid item xs={6}>
                  <Controller
                    name="vehicleType"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth error={!!errors.vehicleType}>
                        <InputLabel>Vehicle Type</InputLabel>
                        <Select {...field} label="Vehicle Type">
                          <MenuItem value="bike">Motorcycle</MenuItem>
                          <MenuItem value="car">Car</MenuItem>
                          <MenuItem value="scooter">Scooter</MenuItem>
                          <MenuItem value="bicycle">Bicycle</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Controller
                    name="vehicleNumber"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Vehicle Number"
                        error={!!errors.vehicleNumber}
                        helperText={errors.vehicleNumber?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Controller
                    name="drivingLicense"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Driving License Number"
                        error={!!errors.drivingLicense}
                        helperText={errors.drivingLicense?.message}
                      />
                    )}
                  />
                </Grid>
              </>
            )}
            {selectedRole === 'customer' && (
              <Grid item xs={12}>
                <Typography variant="body1" color="text.secondary">
                  Great! You're all set to start shopping for medicines and managing your prescriptions.
                </Typography>
              </Grid>
            )}
          </Grid>
        );

      default:
        return null;
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 8, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Create Account
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Join our e-pharmacy platform
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <form onSubmit={handleSubmit(onSubmit)}>
          {renderStepContent(activeStep)}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              variant="outlined"
            >
              Back
            </Button>
            
            {activeStep === steps.length - 1 ? (
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                startIcon={loading && <CircularProgress size={20} />}
                onClick={() => {
                  console.log('Submit button clicked');
                  console.log('Current form errors:', errors);
                  console.log('Form values:', watch());
                }}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>
            ) : (
              <Button onClick={handleNext} variant="contained">
                Next
              </Button>
            )}
          </Box>
        </form>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2">
            Already have an account?{' '}
            <Link component={RouterLink} to="/login" color="primary">
              Sign in here
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default RegisterPage; 