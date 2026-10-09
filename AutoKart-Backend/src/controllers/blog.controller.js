const slugify = require('slugify');
const { translateToMarathi } = require("../utils/translator");
class BlogController {
    // Get all blog posts for user site
    static async getAllPosts(req, res) {
        try {
            const db = req.db;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            const category = req.query.category;
            const tag = req.query.tag;

            let whereClause = "WHERE b.status = 'published'";
            let queryParams = [];

            if (category) {
                whereClause += " AND bc.slug = ?";
                queryParams.push(category);
            }

            if (tag) {
                whereClause += " AND bt.slug = ?";
                queryParams.push(tag);
            }

            const query = `
                SELECT 
                    b.id, b.title, b.slug, b.excerpt, b.featured_image, 
                    b.author, b.created_at, b.view_count,
                    GROUP_CONCAT(DISTINCT c.name) as categories,
                    GROUP_CONCAT(DISTINCT t.name) as tags
                FROM blogs b
                LEFT JOIN blog_post_categories bpc ON b.id = bpc.blog_id
                LEFT JOIN blog_categories c ON bpc.category_id = c.id
                LEFT JOIN blog_post_tags bpt ON b.id = bpt.blog_id
                LEFT JOIN blog_tags t ON bpt.tag_id = t.id
                ${category ? 'LEFT JOIN blog_categories bc ON bpc.category_id = bc.id' : ''}
                ${tag ? 'LEFT JOIN blog_tags bt ON bpt.tag_id = bt.id' : ''}
                ${whereClause}
                GROUP BY b.id
                ORDER BY b.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const countQuery = `
                SELECT COUNT(DISTINCT b.id) as total
                FROM blogs b
                LEFT JOIN blog_post_categories bpc ON b.id = bpc.blog_id
                LEFT JOIN blog_categories c ON bpc.category_id = c.id
                LEFT JOIN blog_post_tags bpt ON b.id = bpt.blog_id
                LEFT JOIN blog_tags t ON bpt.tag_id = t.id
                ${category ? 'LEFT JOIN blog_categories bc ON bpc.category_id = bc.id' : ''}
                ${tag ? 'LEFT JOIN blog_tags bt ON bpt.tag_id = bt.id' : ''}
                ${whereClause}
            `;

            const [posts] = await db.promise().query(query, [...queryParams, limit, offset]);
            const [countResult] = await db.promise().query(countQuery, queryParams);

            const totalPosts = countResult[0].total;
            const totalPages = Math.ceil(totalPosts / limit);


           const lang = req.query.lang || req.session.lang || "en";
            // Parse categories and tags
            posts.forEach(post => {
                post.categories = post.categories ? post.categories.split(',') : [];
                post.tags = post.tags ? post.tags.split(',') : [];
            });

            // 🔥 AUTO TRANSLATE
if (lang === "mr") {
    for (let post of posts) {
        post.title = await translateToMarathi(post.title);
        post.excerpt = await translateToMarathi(post.excerpt);

        post.categories = await Promise.all(
            post.categories.map(cat => translateToMarathi(cat))
        );

        post.tags = await Promise.all(
            post.tags.map(tag => translateToMarathi(tag))
        );
    }
}

            res.json({
                posts,
                pagination: {
                    current_page: page,
                    total_pages: totalPages,
                    total_posts: totalPosts,
                    has_next: page < totalPages,
                    has_prev: page > 1
                }
            });
        } catch (error) {
            console.error('Blog fetch error:', error);
            res.status(500).json({ error: 'Failed to fetch blog posts' });
        }
    }

    // Get single blog post
    static async getPostBySlug(req, res) {
        try {
            const db = req.db;
            const { slug } = req.params;

            const query = `
                SELECT 
                    b.*, 
                    GROUP_CONCAT(DISTINCT c.name) as categories,
                    GROUP_CONCAT(DISTINCT c.slug) as category_slugs,
                    GROUP_CONCAT(DISTINCT t.name) as tags,
                    GROUP_CONCAT(DISTINCT t.slug) as tag_slugs
                FROM blogs b
                LEFT JOIN blog_post_categories bpc ON b.id = bpc.blog_id
                LEFT JOIN blog_categories c ON bpc.category_id = c.id
                LEFT JOIN blog_post_tags bpt ON b.id = bpt.blog_id
                LEFT JOIN blog_tags t ON bpt.tag_id = t.id
                WHERE b.slug = ? AND b.status = 'published'
                GROUP BY b.id
            `;

            const [posts] = await db.promise().query(query, [slug]);

            if (posts.length === 0) {
                return res.status(404).json({ error: 'Blog post not found' });
            }

            const post = posts[0];
            const lang = req.query.lang || req.session.lang || "en";
            // Parse categories and tags
            post.categories = post.categories ? post.categories.split(',') : [];
            post.category_slugs = post.category_slugs ? post.category_slugs.split(',') : [];
            post.tags = post.tags ? post.tags.split(',') : [];
            post.tag_slugs = post.tag_slugs ? post.tag_slugs.split(',') : [];
          
            // 🔥 AUTO TRANSLATE SINGLE POST
if (lang === "mr") {
    post.title = await translateToMarathi(post.title);
    post.excerpt = await translateToMarathi(post.excerpt);
    post.content = await translateToMarathi(post.content);

    post.categories = await Promise.all(
        post.categories.map(cat => translateToMarathi(cat))
    );

    post.tags = await Promise.all(
        post.tags.map(tag => translateToMarathi(tag))
    );
}
            // Increment view count
            await db.promise().query('UPDATE blogs SET view_count = view_count + 1 WHERE id = ?', [post.id]);

            res.json(post);
        } catch (error) {
            console.error('Blog post fetch error:', error);
            res.status(500).json({ error: 'Failed to fetch blog post' });
        }
    }

    // Get all categories
    static async getAllCategories(req, res) {
        try {
            const db = req.db;
            const query = `
                SELECT c.*, COUNT(bpc.blog_id) as post_count
                FROM blog_categories c
                LEFT JOIN blog_post_categories bpc ON c.id = bpc.category_id
                LEFT JOIN blogs b ON bpc.blog_id = b.id AND b.status = 'published'
                GROUP BY c.id
                ORDER BY c.name
            `;

            const [categories] = await db.promise().query(query);
            const lang = req.query.lang || req.session.lang || "en";
if (lang === "mr") {
    for (let cat of categories) {
        cat.name = await translateToMarathi(cat.name);
    }
}
            res.json(categories);
        } catch (error) {
            console.error('Categories fetch error:', error);
            res.status(500).json({ error: 'Failed to fetch categories' });
        }
    }

    // Get all tags
    static async getAllTags(req, res) {
        try {
            const db = req.db;
            const query = `
                SELECT t.*, COUNT(bpt.blog_id) as post_count
                FROM blog_tags t
                LEFT JOIN blog_post_tags bpt ON t.id = bpt.tag_id
                LEFT JOIN blogs b ON bpt.blog_id = b.id AND b.status = 'published'
                GROUP BY t.id
                ORDER BY t.name
            `;

            const [tags] = await db.promise().query(query);
           const lang = req.query.lang || req.session.lang || "en";

if (lang === "mr") {
    for (let tag of tags) {
        tag.name = await translateToMarathi(tag.name);
    }
}
            res.json(tags);
        } catch (error) {
            console.error('Tags fetch error:', error);
            res.status(500).json({ error: 'Failed to fetch tags' });
        }
    }

    // Admin: Get all posts (including drafts)
    static async adminGetAllPosts(req, res) {
        try {
            const db = req.db;
            const page = parseInt(req.query.page) || 1;
            const limit = 10;
            const offset = (page - 1) * limit;

            const query = `
                SELECT 
                    b.id, b.title, b.slug, b.excerpt, b.status, b.author, 
                    b.created_at, b.updated_at, b.view_count,
                    GROUP_CONCAT(DISTINCT c.name) as categories
                FROM blogs b
                LEFT JOIN blog_post_categories bpc ON b.id = bpc.blog_id
                LEFT JOIN blog_categories c ON bpc.category_id = c.id
                GROUP BY b.id
                ORDER BY b.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const countQuery = 'SELECT COUNT(*) as total FROM blogs';

            const [posts] = await db.promise().query(query, [limit, offset]);
            const [countResult] = await db.promise().query(countQuery);

            const totalPosts = countResult[0].total;
            const totalPages = Math.ceil(totalPosts / limit);

            posts.forEach(post => {
                post.categories = post.categories ? post.categories.split(',') : [];
            });

            res.json({
                posts,
                pagination: {
                    current_page: page,
                    total_pages: totalPages,
                    total_posts: totalPosts
                }
            });
        } catch (error) {
            console.error('Admin blog fetch error:', error);
            res.status(500).json({ error: 'Failed to fetch blog posts' });
        }
    }

    // Admin: Create new post
    static async createPost(req, res) {
        try {
            const db = req.db;
            const { title, content, excerpt, featured_image, author, status, meta_title, meta_description, meta_keywords, categories, tags } = req.body;

            const slug = slugify(title, { lower: true, strict: true });

            const query = `
                INSERT INTO blogs (title, slug, content, excerpt, featured_image, author, status, meta_title, meta_description, meta_keywords)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const [result] = await db.promise().query(query, [title, slug, content, excerpt, featured_image, author || 'AutoKart Team', status || 'draft', meta_title, meta_description, meta_keywords]);

            const blogId = result.insertId;

            // Add categories
            if (categories && categories.length > 0) {
                const categoryValues = categories.map(catId => [blogId, catId]);
                await db.promise().query('INSERT INTO blog_post_categories (blog_id, category_id) VALUES ?', [categoryValues]);
            }

            // Add tags
            if (tags && tags.length > 0) {
                const tagValues = tags.map(tagId => [blogId, tagId]);
                await db.promise().query('INSERT INTO blog_post_tags (blog_id, tag_id) VALUES ?', [tagValues]);
            }

            res.json({ success: true, message: 'Blog post created successfully', id: blogId });
        } catch (error) {
            console.error('Create post error:', error);
            res.status(500).json({ error: 'Failed to create blog post' });
        }
    }

    // Admin: Update post
    static async updatePost(req, res) {
        try {
            const db = req.db;
            const { id } = req.params;
            const { title, content, excerpt, featured_image, author, status, meta_title, meta_description, meta_keywords, categories, tags } = req.body;

            const slug = slugify(title, { lower: true, strict: true });

            const query = `
                UPDATE blogs 
                SET title = ?, slug = ?, content = ?, excerpt = ?, featured_image = ?, 
                    author = ?, status = ?, meta_title = ?, meta_description = ?, meta_keywords = ?
                WHERE id = ?
            `;

            await db.promise().query(query, [title, slug, content, excerpt, featured_image, author || 'AutoKart Team', status || 'draft', meta_title, meta_description, meta_keywords, id]);

            // Update categories
            await db.promise().query('DELETE FROM blog_post_categories WHERE blog_id = ?', [id]);
            if (categories && categories.length > 0) {
                const categoryValues = categories.map(catId => [id, catId]);
                await db.promise().query('INSERT INTO blog_post_categories (blog_id, category_id) VALUES ?', [categoryValues]);
            }

            // Update tags
            await db.promise().query('DELETE FROM blog_post_tags WHERE blog_id = ?', [id]);
            if (tags && tags.length > 0) {
                const tagValues = tags.map(tagId => [id, tagId]);
                await db.promise().query('INSERT INTO blog_post_tags (blog_id, tag_id) VALUES ?', [tagValues]);
            }

            res.json({ success: true, message: 'Blog post updated successfully' });
        } catch (error) {
            console.error('Update post error:', error);
            res.status(500).json({ error: 'Failed to update blog post' });
        }
    }

    // Admin: Delete post
    static async deletePost(req, res) {
        try {
            const db = req.db;
            const { id } = req.params;

            await db.promise().query('DELETE FROM blogs WHERE id = ?', [id]);

            res.json({ success: true, message: 'Blog post deleted successfully' });
        } catch (error) {
            console.error('Delete post error:', error);
            res.status(500).json({ error: 'Failed to delete blog post' });
        }
    }

    // Admin: Get single post for editing
    static async adminGetPost(req, res) {
        try {
            const db = req.db;
            const { id } = req.params;

            const query = `
                SELECT 
                    b.*,
                    GROUP_CONCAT(DISTINCT c.id) as category_ids,
                    GROUP_CONCAT(DISTINCT t.id) as tag_ids
                FROM blogs b
                LEFT JOIN blog_post_categories bpc ON b.id = bpc.blog_id
                LEFT JOIN blog_categories c ON bpc.category_id = c.id
                LEFT JOIN blog_post_tags bpt ON b.id = bpt.blog_id
                LEFT JOIN blog_tags t ON bpt.tag_id = t.id
                WHERE b.id = ?
                GROUP BY b.id
            `;

            const [posts] = await db.promise().query(query, [id]);

            if (posts.length === 0) {
                return res.status(404).json({ error: 'Blog post not found' });
            }

            const post = posts[0];
            post.category_ids = post.category_ids ? post.category_ids.split(',').map(id => parseInt(id)) : [];
            post.tag_ids = post.tag_ids ? post.tag_ids.split(',').map(id => parseInt(id)) : [];

            res.json(post);
        } catch (error) {
            console.error('Admin get post error:', error);
            res.status(500).json({ error: 'Failed to fetch blog post' });
        }
    }

    // Admin: Get all categories (NO TRANSLATION)
static async adminGetAllCategories(req, res) {
    try {
        const db = req.db;

        const [categories] = await db.promise().query(
            "SELECT * FROM blog_categories ORDER BY name"
        );

        res.json(categories);
    } catch (error) {
        console.error('Admin categories fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
}

// Admin: Get all tags (NO TRANSLATION)
static async adminGetAllTags(req, res) {
    try {
        const db = req.db;

        const [tags] = await db.promise().query(
            "SELECT * FROM blog_tags ORDER BY name"
        );

        res.json(tags);
    } catch (error) {
        console.error('Admin tags fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch tags' });
    }
}
}



module.exports = BlogController;