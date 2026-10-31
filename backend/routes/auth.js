const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();
router.post('/register', async (req,res)=>{
  try{
    const {name,email,password}=req.body;
    if(await User.findOne({email})) return res.status(400).json({success:false,error:'Email already registered'});
    const hash=await bcrypt.hash(password,10);
    const user=await User.create({name,email,password:hash});
    const token=jwt.sign({id:user._id},process.env.JWT_SECRET||'secret',{expiresIn:'7d'});
    res.json({success:true,token,user:{name:user.name,email:user.email,credits:user.credits}});
  }catch(e){res.status(500).json({success:false,error:e.message});}
});
router.post('/login', async (req,res)=>{
  try{
    const {email,password}=req.body;
    const user=await User.findOne({email});
    if(!user) return res.status(400).json({success:false,error:'Invalid credentials'});
    if(!(await bcrypt.compare(password,user.password))) return res.status(400).json({success:false,error:'Invalid credentials'});
    const token=jwt.sign({id:user._id},process.env.JWT_SECRET||'secret',{expiresIn:'7d'});
    res.json({success:true,token,user:{name:user.name,email:user.email,credits:user.credits}});
  }catch(e){res.status(500).json({success:false,error:e.message});}
});
module.exports=router;
