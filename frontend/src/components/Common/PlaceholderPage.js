import React from 'react';
import { Box, Typography, Paper, Container } from '@mui/material';
import { Construction } from '@mui/icons-material';

const PlaceholderPage = ({ title = 'Page Under Construction', description = 'This page is currently being developed.' }) => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Paper
          sx={{
            p: 4,
            textAlign: 'center',
            bgcolor: 'grey.50',
          }}
        >
          <Construction sx={{ fontSize: 64, color: 'grey.500', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            {title}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {description}
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default PlaceholderPage; 