import express from 'express';
import { register, login, getMe, updateProfile, updateCompany, getTeam, addTeamMember, removeTeamMember, forgotPassword, resetPassword, deleteAccount } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/company', protect, updateCompany);
router.get('/team', protect, getTeam);
router.post('/team', protect, addTeamMember);
router.delete('/team/:id', protect, removeTeamMember);
router.delete('/account', protect, deleteAccount);

export default router;
