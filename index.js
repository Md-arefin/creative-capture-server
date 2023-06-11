const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.STRIPE_KEY)

// middleware
const corsOptions = {
  origin: '*',
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions));
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

    const classCollection = client.db('creativeCaptureDB').collection('classes');
    const instructorCollection = client.db('creativeCaptureDB').collection('instructors');
    const selectedClassCollection = client.db('creativeCaptureDB').collection('selected-classes');
    const paymentCollection = client.db('creativeCaptureDB').collection('payments');
    const userCollection = client.db('creativeCaptureDB').collection('users');

    // get popular classes data

    app.get('/popularClass', async (req, res) => {
      const cursor = classCollection.find().sort({ numberOfStudents: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    })

    // get popular instructors data

    app.get('/popularInstructor', async (req, res) => {
      const cursor = instructorCollection.find().sort({ numberOfStudents: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get('/instructors', async (req, res) => {
      const result = await instructorCollection.find().toArray()
      res.send(result);
    })

    app.get('/classes', async (req, res) => {
      const result = await classCollection.find().toArray()
      res.send(result);
    })

    // selected class

    app.get('/classSelected', async (req, res) => {
      const email = req.query.email;
      // console.log(email)
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await selectedClassCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/classSelected', async (req, res) => {
      const classItem = req.body;
      // console.log(classItem);
      const result = await selectedClassCollection.insertOne(classItem);
      res.send(result);
    })

    app.delete('/classSelected/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id)
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassCollection.deleteOne(query);
      res.send(result);
    })

    //create payments intent
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      console.log(amount)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      })
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    // payment related api
    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const InsertResult = await paymentCollection.insertOne(payment);
      const query = { _id: { $in: payment.selectedClassItems.map(id => new ObjectId(id)) } }
      const deleteResult = await selectedClassCollection.deleteMany(query)
      res.send({ InsertResult, deleteResult });
    })

    // user api
    app.post('/users', async (req, res) => {
     const user = req.body;
     const query = { email: user.email }
     const existingUser = await userCollection.findOne(query)
     if(existingUser){
      return res.send('asos bhai')
     }
     console.log(user)
      const result = await userCollection.insertOne(user);
      res.send(result)
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