'use client';

import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { Iconify } from 'src/components/iconify';

import { FormHead } from '../../components/form-head';

export function JwtSignInView() {
  const loginWithGoogle = () => {
    window.location.assign('/api/v1/auth/google');
  };

  return (
    <>
      <FormHead
        title="Sign in to My Kanban"
        description="Only Google accounts in the private email allowlist can access this board."
        sx={{ textAlign: { xs: 'center', md: 'left' } }}
      />

      <Button
        fullWidth
        size="large"
        variant="contained"
        color="inherit"
        onClick={loginWithGoogle}
        startIcon={<Iconify icon="socials:google" />}
      >
        Continue with Google
      </Button>

      <Typography variant="caption" sx={{ mt: 2, display: 'block', color: 'text.secondary' }}>
        Authentication uses a secure server-side session. No password is stored by this app.
      </Typography>
    </>
  );
}
