'use client';

import axios, { endpoints } from 'src/lib/axios';

/** **************************************
 * Sign out
 *************************************** */
export const signOut = async (): Promise<void> => {
  try {
    await axios.post(endpoints.auth.logout);
  } catch (error) {
    console.error('Error during sign out:', error);
    throw error;
  }
};
