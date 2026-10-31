import express from 'express';
import jwt from 'jsonwebtoken';
import Content from '../models/Content.js';
import User from '../models/User.js';
const router=express.Router();
const auth=(req,res,next)=>{
  const h=req.headers.authorization;
  if(!h) return res.status(401).json({success:false,error:'No token'});
  try{ req.uid=jwt.verify(h.split(' ')[1],process.env.JWT_SECRET||'secret').id; next(); }
  catch(e){ res.status(401).json({success:false,error:'Invalid token'}); }
};
router.post('/',auth,async(req,res)=>{
  const user=await User.findById(req.uid);
  if(user.credits<=0) return res.status(400).json({success:false,error:'No credits left'});
  const c=await Content.create({userId:req.uid,...req.body});
  user.credits-=1; await user.save();
  res.json({success:true,data:c,credits:user.credits});
});
router.get('/',auth,async(req,res)=>{
  const page=parseInt(req.query.page)||1, limit=10;
  const q={userId:req.uid};
  if(req.query.search) q.prompt={$regex:req.query.search,$options:'i'};
  const data=await Content.find(q).sort({createdAt:-1}).skip((page-1)*limit).limit(limit);
  const total=await Content.countDocuments(q);
  res.json({success:true,data,total,pages:Math.ceil(total/limit)});
});
router.delete('/:id',auth,async(req,res)=>{
  await Content.deleteOne({_id:req.params.id,userId:req.uid});
  res.json({success:true,message:'Deleted successfully'});
});
export default router;
