const { ObjectId } = require('mongodb');
const { generateText } = require('./open_ai');
const client = require('./database.js');
const DATABASE = "hackprinceton";
const ESSAY = "essays";
const SCHOLARSHIPS = "scholarships";

exports.uploadEssay = async (essay) => {
    try {
        await client.connect();
        const db = client.db(DATABASE);
        const collection = db.collection(ESSAY);
        
        const result = await collection.insertOne(essay);
        console.log(`An essay was inserted with the _id: ${result.insertedId}`);
        
        return {
            _id: result.insertedId,
            ...essay
        };
    } catch (error) {
        console.error("Error inserting essay into database:", error);
        throw new Error("Failed to insert essay into database");
    } finally {
        await client.close();
    }
};

exports.uploadEssayHandler = async (req, res) => {
    const { text, userId } = req.body;
    if (!text || !userId) {
        return res.status(400).send('Essay text and user ID are required.');
    }

    try {
        const essay = {
            text,
            user: new ObjectId(userId),
            category: [],
        };

        const insertedEssay = await exports.uploadEssay(essay);
        res.status(201).send(insertedEssay);
    } catch (error) {
        console.error('Error uploading essay:', error);
        res.status(500).send('An error occurred while uploading the essay.');
    }
};

exports.deleteEssay = async (essayId) => {
    try {
        await client.connect();
        const db = client.db(DATABASE);
        const collection = db.collection(ESSAY);
        
        const result = await collection.deleteOne({ _id: new ObjectId(essayId) });
        
        if (result.deletedCount === 0) {
            console.log(`No essay found with ID: ${essayId}`);
            return false;
        } else {
            console.log(`Deleted essay with ID: ${essayId}`);
            return true;
        }
    } catch (error) {
        console.error(`Error deleting essay with ID ${essayId}:`, error);
        throw error;
    } finally {
        await client.close();
    }
};

exports.deleteEssayHandler = async (req, res) => {
    const { essayId } = req.body;

    if (!essayId) {
        return res.status(400).send('Essay ID is required.');
    }

    try {
        await client.connect();
        const db = client.db(DATABASE);

        
        const success = await this.deleteEssay(essayId)

        if (success) {
            res.status(200).send({ message: `Deleted essay with ID: ${essayId}` });
        } else {
            res.status(404).send({ message: `Essay not found with ID: ${essayId}` });
        }
    } catch (error) {
        console.error('Error deleting essay:', error);
        res.status(500).send({ message: 'An error occurred while deleting the essay.' });
    }
};

exports.combineEssays = async (req, res) => {
    const { essayIds, scholarshipId } = req.body;

    if (!essayIds || !scholarshipId) {
        return res.status(400).send('Essay IDs and scholarship ID are required.');
    }

    try {
        await client.connect();
        const db = client.db(DATABASE);

        // Fetch essays
        const essays = await db.collection(ESSAY).find({
            _id: { $in: essayIds.map(id => new ObjectId(id)) }
        }).toArray();

        // Fetch scholarship
        const scholarship = await db.collection(SCHOLARSHIPS).findOne({ _id: new ObjectId(scholarshipId) });

        // Combine essay texts
        const combinedText = essays.map(essay => essay.text).join('\n');

        //OpenAI
        const messages = [
            { 
              role: "system", 
              content: `You are a helpful assistant. Your task is to refine the following text to align with the scholarship's categories of ${scholarship.category.join(", ")}. Ensure that the new essay is not over 500 words. Return only the refined text.` 
            },
            { 
              role: "user", 
              content: combinedText 
            }
        ];
          
        const model = "gpt-3.5-turbo";
        const refinedText = await generateText(messages, model);

        res.status(200).send({ combinedText: refinedText });
    } catch (error) {
        console.error('Error combining essays:', error);
        res.status(500).send('An error occurred while combining the essays.');
    } finally {
        await client.close();
    }
};

exports.getEssays = async (userId) => {
    try {
        await client.connect();
        const db = client.db(DATABASE);
        const collection = db.collection(ESSAY);

        const essays = await collection.find({ user: new ObjectId(userId) }).toArray();
        console.log(`Found ${essays.length} essays for user with ID: ${userId}`);

        return essays;
    } catch (error) {
        console.error(`Error retrieving essays for user with ID ${userId}:`, error);
        throw new Error("Failed to retrieve essays from database");
    } finally {
        await client.close();
    }
};

exports.getEssaysHandler = async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).send('User ID is required.');
    }
    try {
        const essays = await exports.getEssays(userId);
        if (essays.length > 0) {
            res.status(200).send(essays);
        } else {
            res.status(404).send({ message: `No essays found for user with ID: ${userId}` });
        }
    } catch (error) {
        console.error('Error retrieving essays:', error);
        res.status(500).send('An error occurred while retrieving the essays.');
    }
};

