import express from 'express';
import {
  register, login, getMe, updateProfile, updateCompany,
  getTeam, addTeamMember, removeTeamMember, resendInvite,
  forgotPassword, resetPassword, setPassword,
  getInvite, acceptInvite, deleteAccount
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// --- Public ---
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/set-password', setPassword);          // invited member sets their own password
router.get('/invite/:token', getInvite);            // look up an invitation
router.post('/invite/:token/accept', acceptInvite); // accept it -> temp password emailed

// --- Authenticated ---
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/company', protect, updateCompany);
router.get('/team', protect, getTeam);
router.post('/team', protect, addTeamMember);
router.post('/team/:id/resend', protect, resendInvite);
router.delete('/team/:id', protect, removeTeamMember);
router.delete('/account', protect, deleteAccount);

export default router;
