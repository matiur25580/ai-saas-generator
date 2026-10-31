import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Content from '../models/Content.js';
const router = express.Router();
const adminAuth = async (req,res,next)=>{
  const h=req.headers.authorization;
  if(!h) return res.status(401).json({success:false,error:'No token'});
  try{
    const decoded=jwt.verify(h.split(' ')[1],process.env.JWT_SECRET||'secret');
    const user=await User.findById(decoded.id);
    if(!user || user.role!=='admin') return res.status(403).json({success:false,error:'Admin only'});
    req.user=user; next();
  }catch(e){ res.status(401).json({success:false,error:'Invalid token'}); }
};
router.get('/stats', adminAuth, async(req,res)=>{
  const totalUsers=await User.countDocuments();
  const totalGenerations=await Content.countDocuments();
  const recentUsers=await User.find().sort({createdAt:-1}).limit(10).select('name email credits role createdAt');
  const recentContent=await Content.find().sort({createdAt:-1}).limit(10).select('prompt persona tone createdAt');
  res.json({success:true, stats:{totalUsers,totalGenerations}, recentUsers, recentContent});
});
router.post('/add-credits', adminAuth, async(req,res)=>{
  const {email, credits}=req.body;
  const user=await User.findOne({email});
  if(!user) return res.status(404).json({success:false,error:'User not found'});
  user.credits+=parseInt(credits); await user.save();
  res.json({success:true,message:`✅ ${credits} credits added to ${email}`, credits:user.credits});
});
export default router;
