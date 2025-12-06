const express = require('express');
const session = require('express-session');
const db = require('./db.js');
const multer = require('multer'); // upload image
const fs = require('fs');
const { findUserInfoByUsername, AddUser,UpdateUser, ValidateLogin } = require('./userController');
const { addTrip, getTripsForUser, deleteTrip, renameTripsUser } = require('./tripController');
const { addPost, getPostsForUser, getAllPosts, deletePost, renamePostsUser } = require('./postsController');//NIEUWW
const { followUser, unfollowUser, getFollowerCount, getFollowingCount, isFollowing, isFollowed } = require('./followController');

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
        res.render('index', { posts });
    } else {
        // Als niet ingelogd, toon index zonder posts
        res.render('index', { posts: [] });
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

app.get('/planner', requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const trips = await getTripsForUser(username);
    res.render('planner', { trips });
});

app.post('/planner', requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const { country, city, date, activity } = req.body;

    const values = [username, country, city, date, activity];
    await addTrip(values);

    res.redirect('/planner');
});

app.get('/trips/:username?', requireAuth, async (req, res) => {
    const username = req.params.username || req.session.user.username;
    const trips = await getTripsForUser(username);
    const isOwnProfile = req.session.user.username === username;
    
    res.render('trips', { trips, username, isOwnProfile });
});

app.post('/trips/delete', requireAuth, async (req, res) => {
  const username = req.session.user.username;
  const { id } = req.body;
  await deleteTrip(id, username);
  res.redirect('/trips');
});

app.get('/api/trips', requireAuth, async (req, res) => {
  const username = req.session.user.username;
  const trips = await getTripsForUser(username);
  res.json(trips);
});

app.get('/map', requireAuth, (req, res) => {
  res.render('map');
});

app.get('/search', requireAuth, async (req, res) => {
    const query = req.query.searchbar;
    
    if (!query) {
        return res.redirect('/');
    }
    
    const username = req.session.user.username;
    const searchTerm = `%${query}%`;
    
    const sqlTrips = `
        SELECT * FROM trips 
        WHERE country LIKE ? OR city LIKE ? OR activity LIKE ?
    `;
    
    const sqlUsers = `
        SELECT id, username, firstName, lastName, email 
        FROM users 
        WHERE username LIKE ? OR firstName LIKE ? OR lastName LIKE ? OR email LIKE ?
    `;
    
    try {
        const tripsResults = await db.query(sqlTrips, [username, searchTerm, searchTerm, searchTerm]);
        
        const usersResults = await db.query(sqlUsers, [searchTerm, searchTerm, searchTerm, searchTerm]);
        
        res.render('search', { 
            trips: tripsResults[0], 
            users: usersResults[0], 
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
        }res.render('otherProfiles', { 
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

// Pagina om een nieuwe post te maken //NIEUWW
app.get('/posts/new', requireAuth, (req, res) => {
    res.render('newPost');
});

// Post toevoegen met foto('s)
app.post('/posts/new', requireAuth, upload.array('images', 5), async (req, res) => {
    const username = req.session.user.username;
    const caption = req.body.caption;
    // Maak array van foto paden
    const imagePaths = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
    await addPost(username, caption, imagePaths);
    res.redirect(`/posts/user/${username}`);
});

// Alle posts bekijken
app.get('/posts', requireAuth, async (req, res) => {
    const posts = await getAllPosts(req.session.user.username);
    res.render('posts', { posts });
});

// Posts van specifieke user
app.get('/posts/user/:username', requireAuth, async (req, res) => {
    const username = req.params.username;
    const profileUser = await findUserInfoByUsername(username);

    const isOwnProfile = req.session.user.username === username;
    const isPrivate = profileUser?.privacy === 'private';
    const following = await isFollowing(req.session.user.username, username);
    const followed = await isFollowed(req.session.user.username, username);
    const canViewPosts = isOwnProfile || !isPrivate || (following && followed) ;

    const posts = canViewPosts ? await getPostsForUser(username) : [];
    
    res.render('userPosts', { posts, username, isOwnProfile, isPrivate, following, followed });
});

// Post verwijderen
app.post('/posts/delete', requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const { id } = req.body;
    await deletePost(id, username);
    res.redirect(`/posts/user/${username}`);
});

const PORT = 3000;
app.listen(PORT, () => console.log(`App listening on http://localhost:${PORT}`));
