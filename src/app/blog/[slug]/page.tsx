import { getPostBySlug, getPostSlugs } from '@/lib/blog/api';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import SimpleHeader from '@/components/seo/SimpleHeader';
import BlogCTA from '@/components/blog/BlogCTA';
import SeoFooter from '@/components/seo/SeoFooter';

export async function generateStaticParams() {
  const slugs = getPostSlugs();
  return slugs.map((slug) => ({
    slug: slug.replace(/\.md$/, ''),
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return { title: 'Not Found' };
  }

  return {
    title: `${post.title} | LeaderboardOS`,
    description: post.metaDescription,
  };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-violet-500/30 flex flex-col">
      <SimpleHeader />
      
      <main className="flex-1 max-w-3xl mx-auto px-6 py-20 md:py-24">
        <Link href="/blog" className="text-violet-400 hover:text-violet-300 text-sm font-medium mb-8 inline-block">
          &larr; Back to all articles
        </Link>
        
        <article>
          <header className="mb-12 border-b border-white/10 pb-8">
            <div className="flex items-center gap-3 text-sm text-neutral-400 mb-4">
              <span>{post.date}</span>
              <span>&bull;</span>
              <span className="text-violet-400">{post.category}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
              {post.title}
            </h1>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center font-bold text-violet-300">
                {post.author.charAt(0)}
              </div>
              <div className="text-sm">
                <p className="font-medium">{post.author}</p>
                <p className="text-neutral-500">Author</p>
              </div>
            </div>
          </header>

          <div className="prose prose-invert prose-violet max-w-none prose-headings:font-bold prose-a:text-violet-400 prose-a:no-underline hover:prose-a:text-violet-300">
            <ReactMarkdown
              components={{
                a: ({ node, ...props }) => {
                  // Custom rendering for links, potentially identifying CTA links
                  return <Link href={props.href || '#'} {...props} />;
                },
                h2: ({ node, ...props }) => <h2 className="text-3xl mt-12 mb-6" {...props} />,
                h3: ({ node, ...props }) => <h3 className="text-2xl mt-8 mb-4" {...props} />,
                p: ({ node, ...props }) => {
                  // Check if this paragraph is just a custom CTA macro like [CTA:Football]
                  const text = props.children?.toString() || '';
                  if (text.startsWith('[CTA:')) {
                    const type = text.replace('[CTA:', '').replace(']', '');
                    if (type === 'Football') {
                      return (
                        <BlogCTA 
                          title="Generate a Football League Table"
                          description="Use our free generator to create, manage, and share your league's standings instantly."
                          buttonText="Try the Football Generator"
                          href="/tools/football-league-table"
                        />
                      );
                    }
                    return <BlogCTA />;
                  }
                  return <p className="text-neutral-300 leading-relaxed mb-6" {...props} />;
                },
                ul: ({ node, ...props }) => <ul className="list-disc pl-6 mb-6 text-neutral-300" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal pl-6 mb-6 text-neutral-300" {...props} />,
                li: ({ node, ...props }) => <li className="mb-2" {...props} />,
              }}
            >
              {post.content}
            </ReactMarkdown>
          </div>
        </article>
      </main>

      <SeoFooter />
    </div>
  );
}
