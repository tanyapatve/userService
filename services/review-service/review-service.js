require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { MongoClient, ObjectId } = require('mongodb');
const PROTO_PATH = __dirname + '/review.proto';
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const reviewProto = grpc.loadPackageDefinition(packageDefinition).review;

let db;

MongoClient.connect(process.env.MONGODB_URI, { useUnifiedTopology: true })
    .then(client => {
        console.log("Connected successfully to MongoDB");
        db = client.db();
    })
    .catch(err => console.error(err));

const reviewService = {
    CreateReview: (call, callback) => {
        const review = call.request;
        db.collection('reviews').insertOne(review, (err, result) => {
            if (err) {
                callback(err);
            } else {
                callback(null, { success: true, message: "Review created successfully" });
            }
        });
    },
    GetReview: (call, callback) => {
        const { reviewID } = call.request;
        db.collection('reviews').findOne({ _id: ObjectId(reviewID) }, (err, review) => {
            if (err) {
                callback(err);
            } else if (!review) {
                callback({ code: grpc.status.NOT_FOUND, details: "Review not found" });
            } else {
                callback(null, review);
            }
        });
    },
    UpdateReview: (call, callback) => {
        const review = call.request;
        db.collection('reviews').updateOne(
          { _id: ObjectId(review.reviewID) },
          { $set: review },
          (err, result) => {
            if (err) {
              callback(err);
            } else if (result.matchedCount === 0) {
              callback({ code: grpc.status.NOT_FOUND, details: "Review not found" });
            } else {
              callback(null, { success: true, message: "Review updated successfully" });
            }
          }
        );
      },
    DeleteReview: (call, callback) => {
        const { reviewID } = call.request;
        db.collection('reviews').deleteOne({ _id: ObjectId(reviewID) }, (err, result) => {
            if (err) {
                callback(err);
            } else if (result.deletedCount === 0) {
                callback({ code: grpc.status.NOT_FOUND, details: "Review not found" });
            } else {
                callback(null, { success: true, message: "Review deleted successfully" });
            }
        });
    },
    ListReviews: (call, callback) => {
        db.collection('reviews').find({}).toArray((err, reviews) => {
            if (err) {
                callback(err);
            } else {
                callback(null, { reviews });
            }
        });
    },
};

const server = new grpc.Server();
server.addService(reviewProto.ReviewService.service, reviewService);

// Add reflection service
const reflection = require('grpc').reflection;
server.addService(reflection.ServerReflectionService.service, reflection.ServerReflectionService);

const port = 50051;
server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(`Review service running on port ${port}`);
});
