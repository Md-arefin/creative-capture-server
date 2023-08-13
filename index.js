const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.STRIPE_KEY)

// middleware

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' })
  }

  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }

    req.decoded = decoded;
    next();
  })

}


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
    const selectedClassCollection = client.db('creativeCaptureDB').collection('selected-classes');
    const paymentCollection = client.db('creativeCaptureDB').collection('payments');
    const userCollection = client.db('creativeCaptureDB').collection('users');

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.send({ token })
    })

    // verify ADmin 
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' })
      }
      next();
    }

    // get popular classes data

    app.get('/popularClass', async (req, res) => {
      const cursor = classCollection.find().sort({ numberOfStudents: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    })


    // all classes

    app.get('/classes', async (req, res) => {
      const result = await classCollection.find().toArray()
      res.send(result);
    })

    app.get('/myClasses/:email', async (req, res) => {
      const email = req.params.email;
      // console.log(email)
      const query = { email: email };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    })

    // add class
    app.post('/classes', async (req, res) => {
      const newItem = req.body;
      const result = await classCollection.insertOne(newItem)
      res.send(result);
    })


    // selected class

    app.get('/classSelected', verifyJWT, async (req, res) => {
      const email = req.query.email;
      // console.log(email)
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;

      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
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
      // console.log(id)
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassCollection.deleteOne(query);
      res.send(result);
    })

    //create payments intent 

    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = Math.round(price * 100);
      // console.log(amount)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'USD',
        payment_method_types: ['card']
      })
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    // payment api 

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const InsertResult = await paymentCollection.insertOne(payment);
      const query = { _id: { $in: payment.selectedClassItems.map(id => new ObjectId(id)) } }
      const deleteResult = await selectedClassCollection.deleteMany(query)
      res.send({ InsertResult, deleteResult });
    })

    app.get('/payments/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await paymentCollection.find(query).toArray()
      res.send(result)
    })

    app.get('/payment/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await paymentCollection.find(query).sort({ date: -1 }).toArray()
      res.send(result)
    })


    // user api

    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result)
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: 'user already exist' })
      }
      // console.log(user)
      const result = await userCollection.insertOne(user);
      res.send(result)
    })

    //  check admin 

    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email;

      const decodedEmail = req.decoded.email;

      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }


      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })

    // check instructor

    app.get('/users/instructor/:email', async (req, res) => {
      const email = req.params.email;

      const decodedEmail = req.decoded.email;

      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }


      const query = { email: email };
      const user = await userCollection.findOne(query);
      // console.log(user)
      const result = { instructor: user?.role === 'instructor' }

      res.send(result);
    })

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result)
    })

    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result)
    })

    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      // console.log(id)
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    // admin classes api 


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