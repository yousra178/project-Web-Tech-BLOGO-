const express = require('express');
const session = require('express-session');
const db = require('./db.js');
const multer = require('multer'); // upload image
const fs = require('fs');
const { findUserInfoByUsername, AddUser, DeleteUser, UpdateUser, ValidateLogin } = require('./userController');
const { addTrip, addTripLocation, editTrip, getTripsForUser,getPublishedTripsForUser, deleteTrip, renameTripsUser, createCollaborativeTrip, getTripDetails, addTripMessage, getTripMessages, getAllTrips } = require('./tripController');
const { addPost, getPostsForUser, getAllPosts, deletePost, renamePostsUser } = require('./postsController');
const { followUser, unfollowUser, getFollowerCount, getFollowingCount, isFollowing, isFollowed, renameFollowsUser, listFollowers, listFollowing, getMutualFriends } = require('./followController');
const { savePostForUser, unsavePostForUser, getSavedPostsForUser, isPostSavedByUser } = require('./bookmarksController');

const path = require('path');

const app = express();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public', 'uploads');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const username = req.session.user?.username || "unknown";
        const ext = path.extname(file.originalname);
        cb(null, `${username}-${Date.now()}${ext}`);
    }
});


const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images allowed'));
        }
    }
});


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


app.use(session({
    secret: 'User',
    resave: false,
    saveUninitialized: false,
}));


app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

app.get('/', async (req, res) => {
    if (req.session.user) {
        // Als ingelogd, toon alle posts
        const posts = await getAllPosts(req.session.user.username);
        const trips = await getAllTrips();
        const currentUser = req.session.user.username;

        // VOEG TOE: Check isSaved voor elke post
        for (let post of posts) {
            post.isSaved = await isPostSavedByUser(currentUser, post.id);
        }

        res.render('index', {
            posts,
            trips,
            user: req.session.user  // Voeg ook user toe voor de template
        });
    } else {
        // Als niet ingelogd, toon index zonder posts
        res.render('index', { posts: [] }, { trips: [] });
    }
});


app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/editProfile', requireAuth, (req, res) => {
    res.render('editProfile', { user: req.session.user });
});

app.post('/editProfile', requireAuth, async (req, res) => {
    const oldUsername = req.session.user.username;

    const fieldsToUpdate = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        username: req.body.username,
        privacy: req.body.privacy
    };

    // if username changes, rename related rows first to avoid FK errors
    const newUsername = req.body.username || oldUsername;
    if (newUsername !== oldUsername) {
        await renameTripsUser(oldUsername, newUsername);
        await renamePostsUser(oldUsername, newUsername);
        await renameFollowsUser(oldUsername, newUsername);
    }

    await UpdateUser(oldUsername, fieldsToUpdate);

    const newUser = await findUserInfoByUsername(newUsername);

    req.session.user = newUser;

    res.redirect('/editProfile');
});


app.post('/upload-profile-pic', requireAuth, upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.redirect('/editProfile');
    }

    const profilePicPath = `/uploads/${req.file.filename}`;
    const username = req.session.user.username;

    await UpdateUser(username, 'profilePic', profilePicPath);
    req.session.user = await findUserInfoByUsername(username);

    res.redirect('/editProfile');
});


app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const isValid = await ValidateLogin(username, password);

    if (!isValid) {
        return res.render("login", { error: "Incorrect username or password" });
    }

    // login OK
    req.session.user = await findUserInfoByUsername(username);
    res.redirect("/profile");
});



app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', (req, res) => {
    const values = [
        req.body.firstName,
        req.body.lastName,
        req.body.email,
        req.body.username,
        req.body.password]

    const result = AddUser(values);
    return res.redirect('/login');
});

function requireAuth(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    next();
}

app.get('/profile', requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const followerCount = await getFollowerCount(username);
    const followingCount = await getFollowingCount(username);
    res.render('profile', { user: req.session.user, followerCount, followingCount });
});

app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

app.post('/deleteAccount', async (req, res) => {
    try {
        const username = req.session.user?.username;

        if (!username) return res.redirect('/login');

        await DeleteUser(username);

        req.session.destroy(() => {
            res.redirect('/');
        });

    } catch (err) {
        console.error(err);
        res.redirect('/editProfile');
    }
});



app.get('/planner', requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const trips = await getTripsForUser(username);
    res.render('planner', {
        user: req.session.user,
        trips,
        editTrip: null  // Add this so the variable is always defined
    });
});

app.post('/planner', requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const { country, city, date, activity } = req.body;

    const values = [username, country, city, date, activity];
    await addTrip(values);

    res.redirect('/planner');
});

app.post('/planner/create', requireAuth, async (req, res) => {
    try {
        const owner = req.session.user.username;
        const { title, description, budget, currency, locations, participants, status } = req.body;

        const tripId = await createCollaborativeTrip(
            owner,
            title,
            description,
            parseFloat(budget),
            currency,
            locations || [],
            participants || [],
            status,
        );

        res.json({ success: true, tripId });
    } catch (err) {
        console.error("❌ Error saving trip:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/planner/edit/:tripId', requireAuth, async (req, res) => {
    const tripId = req.params.tripId;

    const trip = await getTripDetails(tripId);
    if (!trip) return res.status(404).send("Trip not found");

    res.render('planner', {
        user: req.session.user,
        editTrip: trip
    });
});


app.post('/planner/update/:tripId', requireAuth, async (req, res) => {
    try {
        const username = req.session.user.username;
        const tripId = req.params.tripId;
        const locations = req.body.locations;
        const participants = req.body.participants;
        const title = req.body.title;
        const description = req.body.description;
        const budget = req.body.budget;
        const currency = req.body.currency;
        const status = req.body.status;

        await editTrip(tripId, username, title, description, parseFloat(budget), currency, locations, participants, status);

        res.json({ success: true, tripId });

    } catch (err) {
        console.error('Error updating trip:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/planner/chat', async (req, res) => {
    const { tripId, username, message } = req.body;
    if (!tripId || !username || !message) {
        return res.json({ success: false, error: 'Missing data' });
    }

    try {
        await addTripMessage(tripId, username, message);
        res.json({ success: true });
    } catch (err) {
        console.error('Error saving chat message:', err);
        res.json({ success: false, error: err.message });
    }
});

app.get('/planner/messages', async (req, res) => {
    const tripId = req.query.tripId;
    const [rows] = await db.query(
        'SELECT username, message, created_at FROM trip_messages WHERE trip_id = ? ORDER BY created_at ASC',
        [tripId]
    );

    const messages = rows.map(r => ({
        username: r.username,
        message: r.message,
        // Tijd in 'HH:MM' formaat
        time: new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

    res.json({ messages });
});

// GET friends the current user follows (to show "Add Friends") NIEUWWWW
app.get('/api/friends', requireAuth, async (req, res) => {
    try {
        const username = req.session.user.username;
        const friends = await getMutualFriends(username);
        res.json(friends);
    } catch (err) {
        console.error('Error fetching friends', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/trips/:username?', requireAuth, async (req, res) => {
    const username = req.params.username || req.session.user.username;
    const targetUser = await findUserInfoByUsername(username);
    const isOwnProfile = req.session.user.username === username;
    const isPrivate = targetUser.privacy === 'private';
    const following = isOwnProfile ? false : await isFollowing(req.session.user.username, username);
    const followed = isOwnProfile ? false : await isFollowed(req.session.user.username, username);
    const canViewTrips = isOwnProfile || !isPrivate || (following && followed);
    let trips = [];

    if (canViewTrips) {
        if (isOwnProfile) {
            // Owner sees everything: draft + published
            trips = await getTripsForUser(username);
        } else {
            // Other users: only published trips
            trips = await getPublishedTripsForUser(username);
        }
    }

    res.render('trips', { trips, username, isOwnProfile, isPrivate, following, followed });
});

app.post('/trips/delete', requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const { id } = req.body;
    await deleteTrip(id, username);
    res.redirect('/trips');
});

app.get('/map', requireAuth, (req, res) => {
    res.render('map');
});

app.get('/search', requireAuth, async (req, res) => {
    const query = req.query.searchbar;

    if (!query) {
        return res.redirect('/');
    }

    const searchTerm = `%${query}%`;

    // Zoek in trips via trip_locations
    const sqlTrips = `
        SELECT t.id, t.username, t.title, t.description, t.budget,
               l.country, l.city, l.activity, l.date
        FROM trips t
        JOIN trip_locations l ON l.trip_id = t.id
        WHERE l.country LIKE ? OR l.city LIKE ? OR l.activity LIKE ?
    `;

    // Zoek in users
    const sqlUsers = `
        SELECT id, username, firstName, lastName, email
        FROM users
        WHERE username LIKE ? OR firstName LIKE ? OR lastName LIKE ? OR email LIKE ?
    `;

    try {
        const [tripsResults] = await db.query(sqlTrips, [searchTerm, searchTerm, searchTerm]);
        const [usersResults] = await db.query(sqlUsers, [searchTerm, searchTerm, searchTerm, searchTerm]);

        res.render('search', {
            trips: tripsResults,
            users: usersResults,
            query: query
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).send('Er is een fout opgetreden bij het zoeken.');
    }
});


app.get('/user/:username', requireAuth, async (req, res) => {
    const username = req.params.username;
    try {
        const user = await findUserInfoByUsername(username);
        if (!user) {
            return res.status(404).send('Gebruiker niet gevonden');
        }
        // Haal ook de trips van deze gebruiker op
        const trips = await getTripsForUser(username);
        const followerCount = await getFollowerCount(username);
        const followingCount = await getFollowingCount(username);
        const isOwnProfile = req.session.user.username === username;
        let following = false;

        if (isOwnProfile) {
            following = false;
        } else {
            following = await isFollowing(req.session.user.username, username);
        } res.render('otherProfiles', {
            profileUser: user,
            trips: trips,
            isOwnProfile,
            followerCount,
            followingCount,
            following
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Er is een fout opgetreden');
    }
});

// Follow en Unfollow
app.post('/user/:username/follow', requireAuth, async (req, res) => {
    const target = req.params.username;
    const me = req.session.user.username;
    const action = req.body.action;
    if (action === 'follow') {
        await followUser(me, target);
    } else {
        await unfollowUser(me, target);
    }

    res.redirect('/user/' + target);
});

app.get('/user/:username/followers', requireAuth, async (req, res) => {
    const username = req.params.username;
    const followers = await listFollowers(username);
    const isOwnProfile = req.session.user.username === username;
    res.render('followers', { username, followers, isOwnProfile });
});

// Single trip detail page
app.get('/trip/:id', requireAuth, async (req, res) => {
    const tripId = req.params.id;
    const currentUser = req.session.user.username;
    const trip = await getTripDetails(tripId);

    const isOwner = trip.username === currentUser;
    res.render('trip', { trip, isOwner });
});

app.get('/user/:username/following', requireAuth, async (req, res) => {
    const username = req.params.username;
    const followingList = await listFollowing(username);
    const isOwnProfile = req.session.user.username === username;
    res.render('following', { username, following: followingList, isOwnProfile });
});

// Pagina om een nieuwe post te maken
app.get('/posts/new', requireAuth, (req, res) => {
    res.render('newPost');
});

// Post toevoegen
app.post('/posts/new', requireAuth, upload.array('images', 5), async (req, res) => {
    const username = req.session.user.username;
    const caption = req.body.caption;
    // Maak array van foto paden
    const imagePaths = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
    await addPost(username, caption, imagePaths);
    res.redirect(`/posts/user/${username}`);
});

// Alle posts bekijken
//app.get('/posts', requireAuth, async (req, res) => {
//  const posts = await getAllPosts(req.session.user.username);
//res.render('posts', { posts });

//post.isSaved = await isPostSavedByUser(req.session.user.username, post.id);
//});

app.get('/posts', requireAuth, async (req, res) => {
    const posts = await getAllPosts(req.session.user.username);
    const currentUser = req.session.user.username;

    // Check isSaved voor elke post
    for (let post of posts) {
        post.isSaved = await isPostSavedByUser(currentUser, post.id);
    }


    res.render('posts', {
        posts,
        user: req.session.user
    });
});

// Posts van specifieke user
app.get('/posts/user/:username', requireAuth, async (req, res) => {
    const username = req.params.username;
    const currentUser = req.session.user.username;
    const profileUser = await findUserInfoByUsername(username);

    const isOwnProfile = req.session.user.username === username;
    const isPrivate = profileUser?.privacy === 'private';
    const following = await isFollowing(req.session.user.username, username);
    const followed = await isFollowed(req.session.user.username, username);
    const canViewPosts = isOwnProfile || !isPrivate || (following && followed);

    const posts = canViewPosts ? await getPostsForUser(username) : [];

    // NIEUWWW
    for (let post of posts) {
        post.isSaved = await isPostSavedByUser(currentUser, post.id);
    }

    res.render('userPosts', { posts, username, isOwnProfile, isPrivate, following, followed });
});

// Post verwijderen
app.post('/posts/delete', requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const { id } = req.body;
    await deletePost(id, username);
    res.redirect(`/posts/user/${username}`);
});

// Post save or unsaven
app.post('/posts/save', requireAuth, async (req, res) => {
    try {
        const username = req.session.user.username;
        const { postId } = req.body;
        const isSaved = await isPostSavedByUser(username, postId);

        if (isSaved) {
            await unsavePostForUser(username, postId);
        } else {
            await savePostForUser(username, postId);
        }

        res.redirect(req.get('Referrer'));
    } catch (err) {
        console.error('Error toggling save:', err);
        res.status(500).send('Er ging iets fout');
    }
});

// Lookup all saved posts from user
app.get('/bookmarks', requireAuth, async (req, res) => {
    try {
        const username = req.session.user.username;
        const isOwnProfile = req.session.user.username === username;
        const savedPosts = await getSavedPostsForUser(username);
        res.render('bookmarks', { posts: savedPosts, username, isOwnProfile: true });
    } catch (err) {
        console.error('Error fetching saved posts:', err);
        res.status(500).send('Er ging iets fout');
    }
});


app.get('/api/trips', requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const trips = await getTripsForUser(username);
    res.json(trips);
});

app.get('/api/posts', requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const posts = await getAllPosts(username);
    res.json(posts);
});

app.get('/api/bookmarks', requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const bookmarks = await getSavedPostsForUser(username);
    res.json(bookmarks);
});


const PORT = 3000;
app.listen(PORT, () => console.log(`App listening on http://localhost:${PORT}`));
