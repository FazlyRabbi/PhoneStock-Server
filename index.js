const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(404).send({ message: "UnAuthorized Access" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(
    token,
    "d18bd9d59f8b158ad19445fb12f4a2e9f945c498a8cbdcd064d8700dc1f8630fae00640be3585b8a4215fe137214798a332b38919a1b7c751d2b48fc",
    function (err, decoded) {
      if (err) {
        return res.status(401).send({ message: "Forbidden Access" });
      }
      req.decoded = decoded;
      next();
    }
  );
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { application } = require("express");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://doctors_portal:doctors_portal@cluster0.r94p6.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const productsCollection = client.db("phoneStock").collection("products");
    const userCollection = client.db("phoneStock").collection("user");
    const deliverdCollection = client.db("phoneStock").collection("deliverd");

    // put  signed user
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = {
        email: email,
      };
      const options = { upsert: true };

      const updateDoc = {
        $set: user,
      };

      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        "d18bd9d59f8b158ad19445fb12f4a2e9f945c498a8cbdcd064d8700dc1f8630fae00640be3585b8a4215fe137214798a332b38919a1b7c751d2b48fc",
        { expiresIn: "10h" }
      );

      res.send({ result, token });
    });

    // get products from db
    app.get("/products", async (req, res) => {
      const result = await productsCollection.find().toArray();
      res.send(result);
    });

    // get single products from db
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const result = await productsCollection.findOne({ _id: ObjectId(id) });
      res.send(result);
    });

    // Update Delivered
    app.patch("/deliver/:uid", async (req, res) => {
      const id = req.params.uid;
      const filter = { _id: ObjectId(id) };
      const product = await productsCollection.findOne(filter);
      const deliver = req.headers.deliver;
      const email = req.headers.email;
      const deliveryAmount = product.quantity - parseInt(deliver);
      const updateDoc = {
        $set: {
          quantity: parseInt(deliveryAmount),
        },
      };
      await productsCollection.updateOne(filter, updateDoc);

      const upDoc = {
        email,
        id: req.headers.id,
        productImg: product.productImg,
        name: product.name,
        quantity: product.quantity,
        suppler: product.suppler,
        price: product.price,
      };

      const ress = await deliverdCollection.insertOne(upDoc);
      res.send(ress);
    });

    // Restock Delivered
    app.patch("/stock/:id", async (req, res) => {
      const id = req.params.id;

      const filter = { _id: ObjectId(id) };

      const product = await productsCollection.findOne(filter);

      const deliver = req.headers.deliver;

      const deliveryAmount = product.quantity + parseInt(deliver);

      const updateDoc = {
        $set: {
          quantity: deliveryAmount,
        },
      };

      const result = await productsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // get deliverd products from db
    app.get("/deliverd", async (req, res) => {
      const result = await deliverdCollection.find().toArray();
      res.send(result);
    });

    // delete product from db
    app.put("/delete/:id", async (req, res) => {
      const _id = req.params.id;
      const resultForId = await deliverdCollection.findOne({
        _id: ObjectId(_id),
      });

      const result = await deliverdCollection.deleteOne({ _id: ObjectId(_id) });

      const id = parseInt(resultForId.id);

      const query = { id: id };

      const r = await productsCollection.findOne(query);

      const re = parseInt(req.headers.quantity);
      const returnStock = r.quantity + re;

      const updateDoc = {
        $set: {
          quantity: returnStock,
        },
      };

      await productsCollection.updateOne(query, updateDoc);

      res.send(result);
    });

    //add product
    app.put("/add", async (req, res) => {
      const fethForLastItem = await productsCollection.find().toArray();

      let id = parseInt(fethForLastItem[fethForLastItem.length - 1].id) + 1;

      const updateDoc = {
        id,
        productImg: req.body.url,
        name: req.body.productName,
        quantity: req.body.quantity,
        suppler: req.body.supplerName,
        price: req.body.price,
        email: req.body.email,
      };

      const result = await productsCollection.insertOne(updateDoc);
    });

    // get my items
    app.get("/myitems", async (req, res) => {
      const email = req.query.email;
      const result = await productsCollection.find({ email: email }).toArray();
      res.send(result);
    });
    // delete my item
    app.get("/myitem/delete/:id", async (req, res) => {
      const id = req.params.id;
      const result = await productsCollection.deleteOne({ _id: ObjectId(id) });
      res.send(result);
    });
  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(process.env.ACCESS_TOKEN_SECRET);
});

app.listen(port, () => {
  console.log(port);
});
