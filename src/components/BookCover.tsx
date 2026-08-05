import type { BookCopy } from '../types';

export function BookCover({ book, size = 'card' }: { book: BookCopy; size?: 'card' | 'small' | 'large' }) {
  return (
    <div className={`book-cover book-cover-${size} cover-${book.coverStyle}`} aria-hidden="true">
      {book.coverImage ? (
        <img src={book.coverImage} alt="" />
      ) : (
        <>
          <span className="cover-orb cover-orb-one" />
          <span className="cover-orb cover-orb-two" />
          <span className="cover-emoji">{book.coverEmoji}</span>
          <span className="cover-title">{book.title}</span>
          <span className="cover-author">{book.author}</span>
        </>
      )}
    </div>
  );
}
