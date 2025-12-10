use std::hash::pedersen_hash;

// Proves knowledge of `secret` whose Pedersen hash equals the public `h_expected`.
fn main(secret: Field, h_expected: pub Field) {
    let h = pedersen_hash([secret]);
    assert(h == h_expected);
}
