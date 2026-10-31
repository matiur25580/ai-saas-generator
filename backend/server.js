import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Content from './models/Content.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/admin', adminRoutes);
import authRoutes from './routes/auth.js';
import contentRoutes from './routes/content.js';
import adminRoutes from './routes/admin.js';

// Connect to MongoDB Atlas using the string in .env
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas successfully!'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// Test Route
app.get('/', (req, res) => {
  res.json({ message: 'AI SaaS Backend Server is running successfully with Database!' });
});

// AI Generation Endpoint + Saving to Database
app.post('/api/generate', async (req, res) => {
  const { prompt, persona, aiTone } = req.body;

  console.log("--- New Request Received from Frontend ---");
  console.log("Prompt:", prompt);

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Simulated AI Response Processing
  const selectedPersona = persona || 'Expert Copywriter';
  const selectedTone = aiTone || 'Professional';

  let aiResult = `[Database & Backend Processed] Generated content by ${selectedPersona} with ${selectedTone} tone:\n\n`;
  aiResult += `"${prompt}"\n\n`;
  aiResult += `1. Core Strategy: Stored permanently in MongoDB Atlas.\n`;
  aiResult += `2. Execution: Managed via Node.js/Express backend.\n`;
  aiResult += `3. Conclusion: Ready for full-stack production.`;

  try {
    // Save generated prompt and response permanently to MongoDB
    const newContent = new Content({
      prompt,
      persona: selectedPersona || 'General',
      tone: selectedTone || 'Professional',
      response: aiResult
    });

    await newContent.save();
    console.log("💾 Successfully saved to MongoDB Atlas!");

    res.json({ success: true, result: aiResult });
  } catch (error) {
    console.error('Error saving to database:', error);
    res.json({ success: true, result: aiResult }); // DB fail holeo result dao
  }
});

// Delete content by ID from MongoDB Atlas
app.delete('/api/content/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedContent = await Content.findByIdAndDelete(id);

    if (!deletedContent) {
      return res.status(404).json({ success: false, error: 'Content not found in database' });
    }

    console.log(`🗑️ Deleted content with ID: ${id} from MongoDB Atlas`);
    res.json({ success: true, message: 'Data deleted successfully from database!' });
  } catch (error) {
    console.error('Error deleting data from database:', error);
    res.status(500).json({ error: 'Failed to delete data from database' });
  }
});

// Update/Edit content by ID in MongoDB Atlas
app.put('/api/content/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { prompt, persona, aiTone, response } = req.body;
    
    const updatedContent = await Content.findByIdAndUpdate(
      id, 
      { prompt, persona, aiTone, response }, 
      { new: true } // Returns the updated document
    );

    if (!updatedContent) {
      return res.status(404).json({ success: false, error: 'Content not found in database' });
    }

    console.log(`✏️ Updated content with ID: ${id} in MongoDB Atlas`);
    res.json({ success: true, message: 'Data updated successfully!', data: updatedContent });
  } catch (error) {
    console.error('Error updating data in database:', error);
    res.status(500).json({ error: 'Failed to update data in database' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
});
