import { getAllPosts } from '@/lib/blog/api';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Metadata } from 'next';
import SimpleHeader from '@/components/seo/SimpleHeader';

export const metadata: Metadata = {
  title: 'Blog | LeaderboardOS',
  description: 'Articles, guides, and tutorials on how to build the perfect leaderboard, tournament bracket, or league table.',
};

export default function BlogIndex() {
  const posts = getAllPosts();

  // Group by category
  const groupedPosts = posts.reduce((acc, post) => {
    const category = post.category || 'Guides';
    if (!acc[category]) acc[category] = [];
    acc[category].push(post);
    return acc;
  }, {} as Record<string, typeof posts>);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-violet-500/30">
      <SimpleHeader />
      
      <main className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            LeaderboardOS Blog
          </h1>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
            Everything you need to know about organizing competitions, tracking scores, and building beautiful leaderboards.
          </p>
        </div>

        <div className="space-y-20">
          {Object.entries(groupedPosts).map(([category, categoryPosts]) => (
            <section key={category}>
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
                <span className="w-8 h-px bg-violet-500/50"></span>
                {category}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categoryPosts.map((post) => (
                  <Link 
                    key={post.slug} 
                    href={`/blog/${post.slug}`}
                    className="group flex flex-col p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-violet-500/30 hover:bg-white/[0.04] transition-all"
                  >
                    <div className="text-xs text-violet-400 mb-3">{post.date}</div>
                    <h3 className="text-xl font-bold mb-2 group-hover:text-violet-300 transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-neutral-400 text-sm flex-1 mb-6">
                      {post.metaDescription}
                    </p>
                    <div className="flex items-center gap-1 text-sm font-medium text-violet-400 group-hover:text-violet-300">
                      Read article <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
