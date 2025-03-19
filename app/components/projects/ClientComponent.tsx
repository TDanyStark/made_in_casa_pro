'use client'
 
import { testAction } from '@/lib/actions/clientsActions'
import { useState } from 'react'
 
export default function LikeButton() {
  const [likes, setLikes] = useState(2)
 
  return (
    <>
      <p>Total Likes: {likes}</p>
      <button
        onClick={async () => {
          const updatedLikes = await testAction()
          console.log(updatedLikes);
          setLikes(updatedLikes)
        }}
      >
        Like
      </button>
    </>
  )
}