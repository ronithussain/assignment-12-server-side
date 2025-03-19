require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken')
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// console.log("Stripe Secret Key:", process.env.STRIPE_SECRET_KEY); 
const port = process.env.PORT || 7000;
const { ObjectId } = require("mongodb"); // objectId import kora holo

// MiddleWare
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.s5ifh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        // Send a ping to confirm a successful connection


        // crud operation is starts here
        const postsCollection = client.db("forumsDB").collection("postItems");
        const commentsCollection = client.db("forumsDB").collection("comments");
        const usersCollection = client.db("forumsDB").collection('users');
        const tagsCollection = client.db("forumsDB").collection('tags');
        const announcementsCollection = client.db("forumsDB").collection('announcements');
        //-----------------------------------------------------

        //__________________jwt starts here_________________
        //api/post 1:
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        })
        //middlewares
        const verifyToken = (req, res, next) => {
            // console.log('inside verify token', req.headers.authorization)
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];

            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'Unauthorized access' })
                }
                req.decoded = decoded;
                next();
            });

        };
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email; // decoded er moddhe je email chilo setake neya holo
            const query = { email: email }; // query diye present email k neya holo
            const user = await usersCollection.findOne(query); // userCollection e email take findOne kora hocche
            const isAdmin = user?.role === 'admin'; // check kora hocche user er role admin ki na?
            if (!isAdmin) { // jodi admin na hoy tahole 403 forbidden access return kore dibe
                return res.status(403).send({ message: 'forbidden access' })
            };
            next(); // jodi hoy tahole next e jete parbe!

        }
        //____________________jwt ends here______________________

        //__________stripe payment gateway starts here___________
        // app.post('/create-payment-intent', async (req, res) => {
        //     const {price} = req.body;
        //     const amount = parseInt(price * 100); // poysa akare count korbe
            
        //     const paymentIntent = await stripe.paymentIntents.create({
        //         amount: amount,
        //         currency: 'usd', 
        //         payment_method_types: ['card'] // extra
        //     });

        //     res.send({
        //         clientSecret: paymentIntent.client_secret
        //     })
        // })
        //__________stripe  payment  gateway ends here___________

        // _________AnnouncementCollection starts here_________
        app.post('/announcements', async (req, res) => {
            const announcement = req.body;

            announcement.createdAt = new Date().toISOString();
            const result = await announcementsCollection.insertOne(announcement);
            res.send(result);
        })
        app.get("/announcements", async (req, res) => {
            const result = await announcementsCollection.find().toArray();
            res.send(result);
        });
        // _________AnnouncementCollection ends here________


        // ____________tagsCollection starts here___________
        // tagsCollection--------------------------get
        app.get('/tags', async (req, res) => {
            const result = await tagsCollection.find().toArray();
            res.send(result);
        })
        // tagsCollection--------------------------post
        app.post('/add-tag', async (req, res) => {
            const tag = req.body;
            const result = await tagsCollection.insertOne(tag);
            res.send(result);
        })
        // _____________tagsCollection ends here____________


        // ___________UsersCollection starts here___________
        // stats or analytics for pieChart and totalUser or posts and comments:API
        app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
            const users = await usersCollection.estimatedDocumentCount();
            const posts = await postsCollection.estimatedDocumentCount();
            const comments = await commentsCollection.estimatedDocumentCount();
            console.log("Admin Stats Data:", { users, posts, comments }); 
            res.send({
                users,
                posts,
                comments,
            })
        })

        // userCollection--------user/admin/:email---or--not
        app.get('/users/admin/:email', verifyToken, async (req, res) => { // ekhane authProvider e je email ase seta req.body theke niye decoded er sathe present email ke check kora hocche je ai email er role ta admin ki na?
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'unauthorized access' })
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin });
        })
        // usersCollection-------subscription--------patch
        app.patch('/users/subscription/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    subscription: 'subscription'
                }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });
        // usersCollection-------admin-------patch
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })
        // usersCollection--------------------deleted
        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            console.log(query, result);
            res.send(result);
        })
        // usersCollection--------search and get------get
        app.get('/users', verifyToken, async (req, res) => {
            const search = req.query.search || '';
            const page = parseInt(req.query.page) || 0;
            const limit = parseInt(req.query.limit) || 5;
            const skip = page * limit;

            const query = search ? { name: { $regex: search, $options: 'i' } } : {};
            const result = await usersCollection.find(query).skip(skip).limit(limit).toArray();
            const totalUsers = await usersCollection.countDocuments(query);
            res.send({ result, totalPages: Math.ceil(totalUsers / limit) });
        })
        // usersCollection---------------------post
        app.post('/users', async (req, res) => {
            const user = req.body;
            // insert email if user dosent exists:
            // you can do this many ways (1. email unique, 2. upsert, 3.simple checking)
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            };
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })
        // _________UsersCollection ends here_________


        //  Like a post ---------------------------------
        app.patch("/posts/like/:id", async (req, res) => {
            const postId = new ObjectId(req.params.id);
            const { userEmail } = req.body;

            const post = await postsCollection.findOne({ _id: postId });

            if (post.downVoters?.includes(userEmail)) {
                return res.json({ error: "Already disliked! Remove dislike first." });
            }

            const update = post.upVoters?.includes(userEmail)
                ? { $pull: { upVoters: userEmail }, $inc: { upVote: -1 } } // Remove like
                : { $addToSet: { upVoters: userEmail }, $inc: { upVote: 1 } }; // Add like

            await postsCollection.updateOne({ _id: postId }, update);
            res.json({ success: true });
        });

        //  Dislike a post----------------------------------
        app.patch("/posts/dislike/:id", async (req, res) => {
            const postId = new ObjectId(req.params.id);
            const { userEmail } = req.body;

            const post = await postsCollection.findOne({ _id: postId });

            if (post.upVoters?.includes(userEmail)) {
                return res.json({ error: "Already liked! Remove like first." });
            }

            const update = post.downVoters?.includes(userEmail)
                ? { $pull: { downVoters: userEmail }, $inc: { downVote: -1 } } // Remove dislike
                : { $addToSet: { downVoters: userEmail }, $inc: { downVote: 1 } }; // Add dislike

            await postsCollection.updateOne({ _id: postId }, update);
            res.json({ success: true });
        });


        // ____________commentsCollection starts here___________
        app.post('/comments', async (req, res) => {
            const { postId, userEmail, userName, userImage, comment } = req.body;
            if (!postId || !userEmail || !comment) {
                return res.status(400).json({ message: "Post ID, User ID এবং Comment লাগবে!" });
            }

            const commentData = {
                postId: new ObjectId(postId),
                userEmail,
                userName,
                userImage,
                comment,
                date: new Date()
            };
            const result = await commentsCollection.insertOne(commentData);
            // console.log(result)
            res.send(result)
        })
        //commentsCollection-------get all comments comment button:
        app.get('/comments/:postId', async (req, res) => {
            const postId = req.params.postId;
            const query = { postId: new ObjectId(postId) };
            const result = await commentsCollection.find(query).toArray();
            const totalComments = await commentsCollection.countDocuments(query);
            res.send({result, totalComments});
        });
        //commentsCollection-----------reported---comments:
        app.post('/report', async (req, res) => {
            const { commentId, feedback } = req.body;
        
            // Ensure commentId is an ObjectId
            const objectId = new ObjectId(commentId);
        
            // Update the comment with the report and feedback
            const result = await commentsCollection.updateOne(
                { _id: objectId },  // Find the comment by ObjectId
                { $set: { reported: true, feedback: feedback } }  // Update fields
            );
        
            res.send(result);
        });
        
        // ____________commentsCollection ends here_____________



        //_________postCollection starts here___________
        //postCollection-------post-details------get
        app.get("/post-details/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const post = await postsCollection.findOne(query);
            res.json(post);
        });

        //postCollection-----post count-----get
        app.get('/postCount/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { authorEmail: email };
            const result = await postsCollection.countDocuments(filter);
            res.send({ count: result })
        })
        // postCollection-----get all data------get
        app.get("/posts", async (req, res) => {
            const { sortBy } = req.query;
            let sortQuery = {};

            if (sortBy === "newest") {
                sortQuery = { createdAt: -1 };
            } else if (sortBy === "popularity") {
                sortQuery = { upVote: -1 };
            }
            const posts = await postsCollection.find().sort(sortQuery).toArray();
            res.json(posts);
        });

        //postCollection----add new post----post
        app.post('/addItems', async (req, res) => {
            const addItems = {
                ...req.body,
                upVoters: [],
                downVoters: []
            };
            const email = addItems.authorEmail;
            const postCount = await postsCollection.countDocuments({ authorEmail: email });

            if (postCount >= 5) {
                return res.status(403).send({ message: "Post limit exceeded! Upgrade to a membership." });
            }

            const result = await postsCollection.insertOne(addItems);
            res.send(result);
        })


        // postCollection--------my post----get
        app.get('/myPosts', async (req, res) => {
            const email = req.query.email;
            const query = { authorEmail: email };
            const result = await postsCollection.find(query).toArray();
            res.send(result);
        });
        //____________________________________________________
        
        
        //   app.post("/report-comment", async (req, res) => {
        //     try {
        //       const { commentId, feedback } = req.body;
        //       await commentsCollection.updateOne(
        //         { _id: new ObjectId(commentId) },
        //         { $set: { feedback, reported: true } }
        //       );
        //       res.json({ message: "Comment reported successfully" });
        //     } catch (error) {
        //       res.status(500).json({ message: "Server error", error });
        //     }
        //   });
          
          

        // postCollection--------my post----delete
        app.delete('/myPosts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await postsCollection.deleteOne(query);
            console.log(query, result);
            res.send(result);
        })

        //usersCollection-----postsCollection------get api for admin-profile:
        app.get('/users/profile/:email', async (req, res) => {
            const email = req.params.email;

            const user = await usersCollection.findOne({ email });
            const results = await postsCollection.find({ authorEmail: email }).sort({ createdAt: -1 }).limit(3).toArray();
            console.log(results)
            res.send({
                name: user.name,
                email: user.email,
                image: user.image,
                isMember: user.isMember,
                results,
            })
        })

        //_________postCollection ends here___________


 


        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);





app.get('/', (req, res) => {
    res.send('Assignment 12 is starting now the server')
})

app.listen(port, () => {
    console.log(`Assignment 12 is starting now the server`);
})