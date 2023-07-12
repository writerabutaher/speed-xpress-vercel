const app = require("./app");
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KAY);
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.n84h1t4.mongodb.net/?retryWrites=true&w=majority`;
const nodemailer = require("nodemailer");
const MailGen = require("mailgen");

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const DBConnect = async () => {
  try {
    await client.connect();
    console.log("success connection to db");
  } catch (error) {
    console.log(error.message);
  }
};

DBConnect();

app.listen(port, () => {
  console.log("server is running in ", port || 5000);
});

app.get("/", (req, res) => {
  res.send({
    message: "speedXpress server is running ",
  });
});

// Nodemailer setup (for sending mail to user )
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASS,
  },
});

const MailGenerator = new MailGen({
  theme: "default",
  product: {
    name: "Mailgen",
    link: "https://mailgen.js/",
  },
});

// collections
const usersCollection = client.db("speed-xpress").collection("users");
const parcelsCollection = client.db("speed-xpress").collection("parcels");
const customerCollection = client.db("speed-xpress").collection("customers");
const shopsCollection = client.db("speed-xpress").collection("shops");

// ------------------------ALL PUT OPERATION _________________________________

// Save user email & generate JWT
app.put("/user/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const user = req.body;

    const filter = { email: email };
    const options = { upsert: true };
    const updateDoc = {
      $set: user,
    };
    const result = await usersCollection.updateOne(filter, updateDoc, options);
    res.send(result);
  } catch (error) {
    console.log(error.message);
  }
});

// ------------------------ALL PUT OPERATION _________________________________

//delivery status update
app.patch("/update-status", async (req, res) => {
  try {
    const { parcelId, updatedStatus } = req.body;
    console.log(parcelId);

    const filter = { _id: new ObjectId(parcelId) };
    const parcelInfo = await parcelsCollection.findOne(filter);
    console.log(parcelInfo);
    // const options = { upsert: true };
    const updateDoc = { $set: { status: updatedStatus } };

    const result = await parcelsCollection.updateOne(filter, updateDoc);

    const {
      customerInfo,
      weight,
      date,
      time,
      deliveryFee,
      TotalchargeAmount,
      paid,
      senderEmail,
      _id,
    } = parcelInfo;
    const { name, email, division, district, address, merchantName } =
      customerInfo;

    const response = {
      body: {
        name: name,
        intro: `Your parcel has arrived. ID: ${_id}`,
        table: {
          data: [
            {
              PARCEL_INFORMATION: `Time: ${time}`,
            },
            {
              Info: `Date: ${date}`,
            },
            {
              Info: `Status: ${paid ? "Paid" : "Unpaid"}`,
            },
            {
              Info: `Address: ${division}, ${district}, ${address}`,
            },
            {
              Info: `Parcel Weight: ${weight}`,
            },
            {
              Info: `Fee: ${deliveryFee}, Total: ${TotalchargeAmount}`,
            },
            {
              Info: `SenderName: ${merchantName ? merchantName : "Sender"}`,
            },
            {
              Info: `SenderEmail: ${senderEmail}`,
            },
          ],
        },
        outro: "Visit Our Website speedxpress.com",
      },
    };

    const mail = MailGenerator.generate(response);

    const message = {
      from: process.env.EMAIL,
      to: email,
      subject: "Place Was Accepted",
      html: mail,
    };

    transporter.sendMail(message, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log("Email sent: " + info.response);
        res.send("parcel confirmation email sent");
      }
    });

    if (result.modifiedCount === 1) {
      res.status(200).send({
        success: true,
        message: "Status updated successfully",
      });
    } else {
      res.status(404).send({
        success: false,
        message: "Failed to update status",
      });
    }
  } catch (error) {
    console.log(error.message);
    res.status(500).send({
      success: false,
      message: `Operation failed`,
    });
  }
});

// update shop data for merchant
app.patch("/update-shop", async (req, res) => {
  try {
    const { shopId, updatedData } = req.body;
    console.log(shopId, updatedData);

    const filter = { _id: new ObjectId(shopId) };
    const options = { upsert: true };
    const updateDoc = {
      $set: {
        shopName: updatedData.shopName,
        fullName: updatedData.ownerName,
        shopNumber: updatedData.shopNumber,
        shopAddress: updatedData.shopAddress,
      },
    };

    const result = await shopsCollection.updateOne(filter, updateDoc, options);
    if (result.modifiedCount === 1) {
      res.status(200).send({
        success: true,
        message: "Status updated successfully",
      });
    } else {
      res.status(404).send({
        success: false,
        message: "Failed to update status",
      });
    }
  } catch (error) {
    console.log(error.message);
    res.status(500).send({
      success: false,
      message: `Operation failed`,
    });
  }
});
//

//

// ------------------------ALL PUT OPERATION _________________________________

//

//

// ------------------------ALL GET OPERATION _________________________________

// generate jwt token
app.get("/jwt", (req, res) => {
  try {
    const { email } = req.query;
    console.log("jwt", email);

    const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "1d",
    });
    if (token) {
      console.log(token);
      res.send({ token });
    } else {
      res.send({ message: "Failed to get token from server" });
    }
  } catch (error) {
    console.log(error);
  }
});

// get a single user by email

app.get("/user/:email", async (req, res) => {
  try {
    const { email } = req.params;
    console.log("get user", email);
    const query = {
      email: email,
    };
    const result = await usersCollection.findOne(query);
    if (result?.account_type) {
      console.log(result?.account_type);
      res.send({
        data: result?.account_type,
        message: `user founded and account type is ${result?.account_type}`,
      });
    } else res.status(200).send({ data: null, message: "no account found" });
  } catch (error) {
    console.log(error.message);
  }
});

app.get("/userData/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const query = {
      email: email,
    };
    const result = await usersCollection.findOne(query);
    res.send(result);
  } catch (error) {
    console.log(error.message);
  }
});

// get all customers
app.get("/customers/:email", async (req, res) => {
  try {
    const merchantEmail = req.params.email;
    console.log("merchant Email", merchantEmail);

    const result = await customerCollection
      .find({ merchantEmail: merchantEmail })
      .toArray();
    if (result.length) {
      res.status(200).send({
        success: true,
        data: result,
      });
    } else {
      res.status(200).send({
        success: false,
        message: `No customer found`,
        data: [],
      });
    }
  } catch (error) {
    console.log(error.message);
    res.status(404).send({
      success: false,
      data: null,
      message: `Operation failed`,
    });
  }
});

// find parcel according to email
app.get("/parcels", async (req, res) => {
  try {
    const senderEmail = req.query.email;
    console.log("Shop Email", senderEmail);

    const result = await parcelsCollection
      .find({ senderEmail: senderEmail })
      .toArray();
    if (result.length) {
      res.status(200).send({
        success: true,
        data: result,
      });
    } else {
      res.status(200).send({
        success: false,
        message: `No Parcels found`,
        data: [],
      });
    }
  } catch (error) {
    console.log(error.message);
    res.status(404).send({
      success: false,
      data: null,
      message: `Operation failed`,
    });
  }
});


///get a single parcel .. to get the status for showing the track level

app.get("/singleParcel", async (req, res) => {
  try {
    const parcelId = req.query.i
    const result = await parcelsCollection.findOne({
      _id: new ObjectId(parcelId),
    });

    if (!result) {
      return res.status(404).json({ error: "Parcel not found" });
    }
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Parcel Not Found" });
  }
});

// get all parcel for admin account
app.get("/all-parcels", async (req, res) => {
  try {
    const result = await parcelsCollection.find({}).toArray();
    if (result.length) {
      res.status(200).send({
        success: true,
        data: result,
      });
    } else {
      res.status(200).send({
        success: false,
        message: `No Parcels found`,
        data: [],
      });
    }
  } catch (error) {
    console.log(error.message);
    res.status(404).send({
      success: false,
      data: null,
      message: `Operation failed`,
    });
  }
});

// get all merchant

app.get("/getUser/:userType", async (req, res) => {
  const userType = req.params.userType;
  try {
    const query = { account_type: userType };
    const result = await usersCollection.find(query).toArray();
    if (result.length) {
      res.status(200).send({
        success: true,
        data: result,
        message: "oparation success",
      });
    } else {
      res.status(200).send({
        success: false,
        message: "no data found ",
        data: [],
      });
    }
  } catch (error) {
    console.log(error);
    res.status(404).send({
      success: false,
      message: `oparation failed`,
      data: null,
    });
  }
});

// get merchant shops
app.get("/shop", async (req, res) => {
  console.log(req.query.email);
  try {
    const shopOwnerEmail = req.query.email;
    const result = await shopsCollection
      .find({ shopEmail: shopOwnerEmail })
      .toArray();
    if (result.length) {
      res.status(200).send({
        success: true,
        message: `successfully found`,
        data: result,
      });
    } else {
      res.status(200).send({
        success: false,
        message: `No shop found`,
        data: [],
      });
    }
  } catch (error) {
    console.log(error.message);
    res.status(404).send({
      success: false,
      data: null,
      message: `Operation failed`,
    });
  }
});

//

//get parcel for delivery boy/ employee filtered by district
app.get("/parcels/:district", async (req, res) => {
  try {
    const { district } = req.params;
    const { status } = req.query;
    console.log({ district, status });

    const query = { "customerInfo.district": district };

    if (status) {
      query.status = status;
    }
    console.log(query);
    const result = await parcelsCollection.find(query).toArray();
    console.log(result);
    res.send(result);
  } catch (error) {
    console.log(error.message);
    res.status(500).send({
      success: false,
      message: "error failed to fetch",
    });
  }
});

//

// ------------------------ALL POST OPERATION _________________________________

// create parcel .
app.post("/parcel", async (req, res) => {
  try {
    const parcelData = req.body;
    console.log(parcelData);

    const {
      customerInfo,
      weight,
      date,
      time,
      deliveryFee,
      TotalchargeAmount,
      paid,
      senderEmail,
    } = parcelData;
    const { name, email, division, district, address, merchantName } =
      customerInfo;

    const result = await parcelsCollection.insertOne(parcelData);

    const response = {
      body: {
        name: name,
        intro: `Your parcel was created. ID: Payment To Get ID`,
        table: {
          data: [
            {
              PARCEL_INFORMATION: `Time: ${time}`,
            },
            {
              Info: `Date: ${date}`,
            },
            {
              Info: `Status: ${paid ? "Paid" : "Unpaid"}`,
            },
            {
              Info: `Address: ${division}, ${district}, ${address}`,
            },
            {
              Info: `Parcel Weight: ${weight}`,
            },
            {
              Info: `Fee: ${deliveryFee}, Total: ${TotalchargeAmount}`,
            },
            {
              Info: `SenderName: ${merchantName ? merchantName : "Sender"}`,
            },
            {
              Info: `SenderEmail: ${senderEmail}`,
            },
          ],
        },
        outro: "Visit Our Website speedxpress.com",
      },
    };

    const mail = MailGenerator.generate(response);

    const message = {
      from: process.env.EMAIL,
      to: email,
      subject: "Place Order Successfully",
      html: mail,
    };

    transporter.sendMail(message, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log("Email sent: " + info.response);
        res.send("parcel confirmation email sent");
      }
    });

    if (result.acknowledged) {
      res.send({
        message: "parcel creation successfully ",
        data: result,
      });
    }
  } catch (error) {
    console.log(error.message);
    res.status(404).send({
      message: "Order failed! for some issue!",
      data: null,
    });
  }
});

// save customer info

// create merchant shop .
app.post("/create-shop", async (req, res) => {
  try {
    const shopData = req.body;
    const result = await shopsCollection.insertOne(shopData);

    const {
      ownerName,
      shopName,
      shopEmail,
      phoneNumber,
      district,
      shopAddress,
    } = shopData;

    const response = {
      body: {
        name: ownerName,
        intro: `Your Shop has Created`,
        table: {
          data: [
            {
              ShopName: `${shopName}`,
              ShopEmail: `${shopEmail}`,
              Address: `${district}, ${shopAddress}`,
              Number: `${phoneNumber}`,
            },
          ],
        },
        outro: "Visit Our Website speedxpress.com",
      },
    };

    const mail = MailGenerator.generate(response);

    const message = {
      from: process.env.EMAIL,
      to: shopEmail,
      subject: "Shop Created Successfully",
      html: mail,
    };

    transporter.sendMail(message, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log("Email sent: " + info.response);
        res.send("shop confirmation email sent");
      }
    });

    if (result.acknowledged) {
      res.send({
        message: "shop creation successfully",
        data: result,
      });
    }
  } catch (error) {
    console.log(error.message);
    res.status(404).send({
      message: "Shop Booking failed! for some issue!",
      data: null,
    });
  }
});

app.put("/customer/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const customer = req.body;

    const filter = { email: email };
    const options = { upsert: true };
    const updateDoc = {
      $set: customer,
    };
    // if customer exist then replace him and if don't exists then create new customer ..
    const result = await customerCollection.updateOne(
      filter,
      updateDoc,
      options
    );

    console.log(result);
    res.send(result);
  } catch (error) {
    console.log(error.message);
  }
});

// payment
// --------------validation for stripe payment
const stripeChargeCallback = (res) => (stripeErr, stripeRes) => {
  if (stripeErr) {
    console.log(stripeErr);
    res.status(500).send({ error: stripeErr });
  } else {
    // console.log(stripeRes)
    res.status(200).send({ success: stripeRes });
  }
};

app.post("/payment", async (req, res) => {
  try {
    const { parcelId, token } = req.body;
    const { brand, country, funding, last4 } = token.card;

    // get  that parcel price from  backend
    const specificParcel = await parcelsCollection.findOne({
      _id: new ObjectId(parcelId),
    });

    // create a charge for it
    const charge = {
      source: token.id,
      amount: specificParcel.TotalchargeAmount * 100,
      currency: "usd",
      // customer: customer.id,
      receipt_email: specificParcel.email,
      description: `The amount paid by ${specificParcel.name}`,
      // billing_details: token.card,
    };
    // console.log(charge)

    // send according response
    stripe.charges.create(charge, stripeChargeCallback(res));

    // update paid status in parcel collection
    const updateResult = await parcelsCollection.updateOne(
      { _id: new ObjectId(parcelId) },
      { $set: { paid: true } }
    );
    console.log(updateResult);

    // send mail

    const response = {
      body: {
        name: token.email,
        intro: `Payment Successfully. Parcel ID: ${parcelId}`,
        table: {
          data: [
            {
              Status: "Paid",
              Payment: `${token.type}`,
              Brand: `${brand}`,
              Country: `${country}`,
              Card: `${funding}`,
              Last4: `${last4}`,
            },
          ],
        },
        outro: "Visit Our Website speedxpress.com",
      },
    };

    const mail = MailGenerator.generate(response);

    const message = {
      from: process.env.EMAIL,
      to: token.email,
      subject: "Parcel Payment Successfully",
      html: mail,
    };

    transporter.sendMail(message, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log("Email sent: " + info.response);
        res.send("parcel confirmation email sent");
      }
    });
  } catch (error) {
    console.error("Payment Error: ", error);
    res.status(500).send({ error: "Payment Error" });
  }
});

// ------------------------ALL Post OPERATION _________________________________

//

//

//
// ------------------------ALL DELETE OPERATION _________________________________

// merchant shop delete
app.delete("/delete-shop", async (req, res) => {
  try {
    const { shopId } = req.body;
    const filter = { _id: new ObjectId(shopId) };
    const result = await shopsCollection.deleteOne(filter);
    if (result.modifiedCount === 1) {
      res.status(200).send({
        success: true,
        message: "shop deleted successfully",
      });
    } else {
      res.status(404).send({
        success: false,
        message: "Failed to delete shop",
      });
    }
  } catch (error) {
    console.log(error.message);
    res.status(500).send({
      success: false,
      message: `Operation failed`,
    });
  }
});

// delete customer
app.delete("/delete/:context/:id", async (req, res) => {
  let result;
  try {
    const { id, context } = req.params;
    console.log(id, context);

    if (context == "customer") {
      result = await customerCollection.deleteOne({ _id: new ObjectId(id) });
    }
    if (context == "employee" || "merchant") {
      result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
    }
    if (context == "parcel") {
      result = await parcelsCollection.deleteOne({ _id: new ObjectId(id) });
    }

    // console.log(result)
    if (result.deletedCount === 1) {
      res.status(200).send({
        success: true,
        message: " Deleted successfully",
      });
    } else {
      res.status(404).send({
        success: false,
        message: "Failed to delete",
      });
    }
  } catch (error) {
    console.log(error.message);
    res.status(500).send({
      success: false,
      message: `Operation failed`,
    });
  }
});
