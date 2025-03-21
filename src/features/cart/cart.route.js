const express = require("express");
const cartRoute = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../auth/auth.model");
const Cart = require("./cart.model");
const {Product} = require("../products/product.model");

const authMiddleWare = async (req, res, next) => {
  // const token = req.headers.token;
  // console.log("Token", token);
  const authHeader = req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send("Token missing or malformed");
  }

  const token = authHeader.split(" ")[1]; // Extract the token
  try {
    
    if (!token) {
      return res.send("Token missing");
    } else {
      let decode = jwt.verify(token, process.env.SECRET_KEY);
      if (!decode) {
        return res.send("Invalid Token");
      } else {
        let user = await User.findOne({ _id: decode._id });
        if (!user) {
          return res.send("user doesn't exit with this email id");
        } else {
          req.userId = user._id;
          next();
        }
      }
    }
  } catch (e) {
    res.send(e.message);
  }
};

cartRoute.use(authMiddleWare);

cartRoute.get("/", async (req, res) => {
  try {
    let carts = await Cart.find({ user: req.userId }).populate([
      {
        path: "user",
        select: ["name", "email", "user_image", "address", "role", "pincode"],
      },
      "product",
    ]);
    res.send(carts);
  } catch (e) {
    res.send(e.message);
  }
});

cartRoute.post("/", async (req, res) => {
  try {
    let dbProduct = await Product.findOne({ _id: req.body.product });
    let cartItem = await Cart.findOne({ product: req.body.product });
    if (cartItem) {
      if (req.body.type == "inc") {
        if (Check(dbProduct, req.body.quantity)) {
          return res.send(
            `Database have only ${dbProduct.quantity} of this item`
          );
        } else {
          let cart = await Cart.findOneAndUpdate(
            { product: req.body.product },
            { $inc: { quantity: 1 } }
          );
          await Product.findByIdAndUpdate(
            { _id: req.body.product },
            { $inc: { quantity: -1 } }
          );
          return res.send(cart);
        }
      } else if (req.body.type == "dec") {
        if (cartItem.quantity == 1) {
          await Cart.findOneAndDelete({ product: req.body.product });
          await Product.findByIdAndUpdate(
            { _id: req.body.product },
            { $inc: { quantity: 1 } }
          );
          return res.send("Deleted");
        } else {
          let cart = await Cart.findOneAndUpdate(
            { product: req.body.product },
            { $inc: { quantity: -1 } }
          );
          await Product.findByIdAndUpdate(
            { _id: req.body.product },
            { $inc: { quantity: 1 } }
          );
          return res.send(cart);
        }
      } else if (req.body.type == "" || !req.body.type) {
        return res.send("Type is missing");
      }
    } else {
      if (Check(dbProduct, req.body.quantity)) {
        return res.send(
          `Database have only ${dbProduct.quantity} of this item`
        );
      } else {
        let cartItem = await Cart.create({
          ...req.body,
          user: req.userId,
        });
        await Product.findByIdAndUpdate(
          { _id: req.body.product },
          { $inc: { quantity: -1 } }
        );
        return res.send(cartItem);
      }
    }
  } catch (e) {
    res.send(e.message);
  }
});

function Check(dbProduct, qty) {
  // console.log("Quantity", qty);
  if (dbProduct.quantity < qty) {
    return true;
  } else {
    return false;
  }
}

cartRoute.delete("/:id", async (req, res) => {
  const { id } = req.params;
  console.log("Id:", id);
  try {
    let cartItem = await Cart.findById({ _id: id });
    // await Product.findByIdAndDelete({ _id: cartItem.product });
    await Product.findByIdAndUpdate(
      { _id: cartItem.product },
      { $inc: { quantity: cartItem.quantity } }
    );
    res.send("Item deleted Successfully");
  } catch (error) {
    res.send({ err: "Something went wrong" });
  }
});
module.exports = cartRoute;
