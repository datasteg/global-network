import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="gn-wrap gn-page">
      <h1>Not found · 페이지가 없습니다</h1>
      <p><Link href="/en">Board</Link> · <Link href="/ko">보드</Link></p>
    </div>
  );
}
