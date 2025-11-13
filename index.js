const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

const app = express();
const port = process.env.PORT || 3000;
// console.log(process.env)


// middleware
app.use(cors());
app.use(express.json());


const serviceAccount = require("./car-rental-platform-sdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});


const verifyFirebaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization
  if(!authorization) {
    return res.status(401).send({ message: "Unauthorized Access" })
  }
  const token = authorization.split(' ')[1]

  try {
    const decoded = await admin.auth().verifyIdToken(token)
    req.token_email = decoded.email
    next()
  } 
  catch {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.0dhjrwr.mongodb.net/?appName=Cluster0`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
    console.log("Car Rent platform is running")
    res.send("Car Rent platform is running");
})

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("Car_Rent_Platform");
    const carsCollection = database.collection("Cars");
    const bookingsCollection = database.collection("bookings");

    // ! Cars Collection API
    app.get("/cars", async (req, res) => {
      const cursor = carsCollection.find();
      const result = await cursor.toArray();    
      res.send(result);
    });

    app.get("/latestCars", async (req, res) => {
      const cursor = carsCollection.find().sort({ modelYear: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/cars/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const car = await carsCollection.findOne(query);
      res.send(car);
    });

    app.post("/addCar", verifyFirebaseToken, async (req, res) => {
      const carData = req.body;
      const result = await carsCollection.insertOne(carData);
      res.send(result);
    });

    // ! My Listing
    // My all cars
    app.get("/myCars", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        if (email !== req.token_email) {
          return res.status(403).send({ message: "Forbidden Access" });
        }
        query.provider_email = email;
      }
      const result = await carsCollection.find(query).toArray();
      res.send(result);
    });
    // car delete
    app.delete("/myCars/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await carsCollection.deleteOne(query);
      res.send(result);
    });

    // ! Update Cars
    app.put("/cars/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const updatedCar = req.body;
      const filter = { _id: new ObjectId(id) };
      const query = { $set: updatedCar };
      const result = await carsCollection.updateOne(filter, query);
      res.send(result);
    });

    // ! Car Details
    app.get("/carDetails/:id", async (req, res) => {
      const id = req.params.id;
      const car = await carsCollection.findOne({ _id: new ObjectId(id) });
      res.send(car);
    });

    // ! My Bookings
    app.get("/myBookings", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        if (email !== req.token_email) {
          return res.status(403).send({ message: "Forbidden Access" });
        }
        query.userEmail = email;
      }
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    // ! Add Booking
    app.post("/bookings", verifyFirebaseToken, async (req, res) => {
      try {
        const booking = req.body;
        const carId = booking.carId; // frontend will send this

        // insert booking
        const bookingResult = await bookingsCollection.insertOne(booking);

        // update car status
        const filter = { _id: new ObjectId(carId) };
        const update = { $set: { carStatus: "Booked" } };
        const carUpdateResult = await carsCollection.updateOne(filter, update);

        res.send({
          success: true,
          message: "Booking successful and car status updated.",
          bookingResult,
          carUpdateResult,
        });
      } catch (error) {
        console.error("Error during booking:", error);
        res.status(500).send({ success: false, message: "Booking failed." });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.listen(port, (req, res) => {
  console.log(`Smart Server is running on port ${port}`);
});