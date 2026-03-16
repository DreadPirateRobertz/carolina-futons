/**
 * Blog Service — web module wrapper for blogContent.
 * Exposes blog functions to public/page files via Wix web module convention.
 */
import { Permissions, webMethod } from 'wix-web-module';
import { getAllBlogPosts, getBlogPost, getBlogSlugs, getBlogFaqs } from 'backend/blogContent';

export const fetchAllBlogPosts = webMethod(Permissions.Anyone, () => getAllBlogPosts());

export const fetchBlogPost = webMethod(Permissions.Anyone, (slug) => getBlogPost(slug));

export const fetchBlogSlugs = webMethod(Permissions.Anyone, () => getBlogSlugs());

export const fetchBlogFaqs = webMethod(Permissions.Anyone, (slug) => getBlogFaqs(slug));
