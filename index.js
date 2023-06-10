const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bqstehg.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const popularClassCollection = client.db('creativeCaptureDB').collection('classes');
    const popularInstructorCollection = client.db('creativeCaptureDB').collection('instructors');
    const selectedClassCollection = client.db('creativeCaptureDB').collection('selected-classes');

    // get popular classes data

    app.get('/popularClass', async (req, res) => {
      const cursor = popularClassCollection.find().sort({ numberOfStudents: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    })

    // get popular instructors data

    app.get('/popularInstructor', async (req, res) => {
      const cursor = popularInstructorCollection.find().sort({ numberOfStudents: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get('/instructors', async (req, res) => {
      const result = await popularInstructorCollection.find().toArray()
      res.send(result);
    })

    app.get('/classes', async (req, res) => {
      const result = await popularClassCollection.find().toArray()
      res.send(result);
    })

    // selected class

    app.get('/classSelected', async (req, res) =>{
      const email = req.query.email;
      // console.log(email)
      if(!email){
        res.send([]);
      }
      const query = { email: email };
      const result = await selectedClassCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/classSelected', async (req,res) =>{
      const classItem = req.body;
      // console.log(classItem);
      const result = await selectedClassCollection.insertOne(classItem);
      res.send(result);
    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send("Creative capture is running");
})

app.listen(port, () => {
  console.log(`Creative capture is running on port:${port}`);
})