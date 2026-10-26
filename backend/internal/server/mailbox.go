package server

import (
	"cmp"
	"slices"
	"sync"
)

// mailbox はクライアントごとの送信待ちメッセージ置き場。
//
// 同じキー（同じ通貨ペア、同じ機会など）のメッセージは最新のものだけを残す。
// これにより、読み出しが遅いクライアントがいても待ち行列が無限に伸びず、
// 追いついたときには常に最新の状態が届く。キューの長さはキーの種類数で頭打ちになる。
type mailbox struct {
	mu     sync.Mutex
	items  map[string]mail
	signal chan struct{}
}

// mail は送信待ちの1件。
type mail struct {
	seq uint64
	msg any
}

func newMailbox() *mailbox {
	return &mailbox{
		items:  make(map[string]mail),
		signal: make(chan struct{}, 1),
	}
}

// Put はメッセージを置く。同じキーが既にあれば置き換える。
func (m *mailbox) Put(key string, seq uint64, msg any) {
	m.mu.Lock()
	m.items[key] = mail{seq: seq, msg: msg}
	m.mu.Unlock()

	// 送信ゴルーチンを起こす。既に起こす予定があれば何もしない（容量1のチャネル）。
	select {
	case m.signal <- struct{}{}:
	default:
	}
}

// Drain は溜まっているメッセージを seq の昇順に取り出し、空にする。
// 受信側は受け取った最大の seq 以下を古いメッセージとして捨てるため、置き換えで seq の大きいものが前に来ないようにする。
// Put はエンジンのロック内から seq の順に呼ばれるので、後で取り出した分は前に取り出した分より seq が大きい。
func (m *mailbox) Drain() []mail {
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.items) == 0 {
		return nil
	}
	out := make([]mail, 0, len(m.items))
	for _, item := range m.items {
		out = append(out, item)
	}
	clear(m.items)
	slices.SortFunc(out, func(a, b mail) int { return cmp.Compare(a.seq, b.seq) })
	return out
}

// Signal はメッセージが置かれたときに通知されるチャネル。
func (m *mailbox) Signal() <-chan struct{} {
	return m.signal
}
