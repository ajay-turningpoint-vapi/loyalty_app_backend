import ReedemableProduct from "../models/redeemableProduct.model";

export const addProduct = async (req, res) => {
    try {
        const { name, diamond,image, stock } = req.body;

        
        
        if (!name || diamond <= 0 || stock < 0) {
            return res.status(400).json({ error: "Invalid product details" });
        }

        const product = new ReedemableProduct({ name, diamond, stock,image});
        await product.save();

        res.status(201).json({ message: "Product added successfully", product });
    } catch (error) {

      
        res.status(500).json({ error: "Server error", details: error.message });
    }
};

export const getProducts = async (req, res) => {
    try {
        const products = await ReedemableProduct.find();
        res.status(200).json({ products });
    } catch (error) {
        res.status(500).json({ error: "Server error", details: error.message });
    }
};

export const editProduct = async (req, res) => {
    try {
        const { name, diamond, stock,image } = req.body;
        const updatedProduct = await ReedemableProduct.findByIdAndUpdate(req.params.id, { name, diamond, stock,image }, { new: true, runValidators: true });

        if (!updatedProduct) return res.status(404).json({ error: "Product not found" });

        res.status(200).json({ message: "Product updated", product: updatedProduct });
    } catch (error) {
        res.status(500).json({ error: "Server error", details: error.message });
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const deletedProduct = await ReedemableProduct.findByIdAndDelete(req.params.id);

        if (!deletedProduct) return res.status(404).json({ error: "Product not found" });

        res.status(200).json({ message: "Product deleted", product: deletedProduct });
    } catch (error) {
        res.status(500).json({ error: "Server error", details: error.message });
    }
};


export const redeemProduct = async (req, res) => {
    try {
      const { userId, productId, quantity } = req.body;
  
      // Validate input
      if (!userId || !productId || quantity <= 0) {
        return res.status(400).json({ error: "Invalid input parameters" });
      }
  
      // Fetch user and product in parallel to optimize DB calls
      const [user, product] = await Promise.all([
        User.findById(userId),
        ReedemableProduct.findById(productId),
      ]);
  
      if (!user || !product) return res.status(404).json({ error: "User or Product not found" });
  
      // Check stock availability
      if (product.stock < quantity) {
        return res.status(400).json({ error: "Not enough stock available" });
      }
  
      // Calculate total price
      const totalPrice = product.diamond * quantity;
  
      // Check if user has enough diamonds
      if (user.diamonds < totalPrice) {
        return res.status(400).json({ error: "Not enough diamonds" });
      }
  
      // Use transactions to ensure atomicity
      const session = await ReedemableProduct.startSession();
      session.startTransaction();
  
      try {
        // Deduct diamonds and update stock atomically
        await User.updateOne({ _id: userId }, { $inc: { diamonds: -totalPrice } }).session(session);
        await ReedemableProduct.updateOne({ _id: productId }, { $inc: { stock: -quantity } }).session(session);
  
        await session.commitTransaction();
        session.endSession();
  
        res.status(200).json({
          message: "Products redeemed successfully",
          redeemedQuantity: quantity,
          remainingDiamonds: user.diamonds - totalPrice, // Return updated diamonds count
          remainingStock: product.stock - quantity, // Return updated stock count
        });
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } catch (error) {
      res.status(500).json({ error: "Server error", details: error.message });
    }
  }