pragma circom 2.1.6;

template HelloWorld() {
    // Public input
    signal input publicNumber;

    // Private input
    signal input privateNumber;

    // Constraint: privateNumber * 2 = publicNumber
    privateNumber * 2 === publicNumber;
}

component main = HelloWorld(); 